/**
 * syncService.ts — the server side of synchronisation.
 *
 * processMutations() is the merge authority: for each mutation a device pushes it
 * runs the shared CRDT merge engine against the canonical record, persists the
 * result, records every decision in the audit trail, and opens a conflict for
 * anything that needs a clinical reviewer.
 */
import { randomUUID } from 'node:crypto';
import { applyMutation } from '@shared/mergeEngine';
import { materialize } from '@shared/materialize';
import type { Conflict, Mutation, MutationResult, PatientDoc, PullResponse, PushResponse } from '@shared/types';
import { WRITE_ROLES } from '@shared/types';
import { MutationLog } from '../models/MutationLog';
import { ConflictModel } from '../models/Conflict';
import { DeviceModel } from '../models/Device';
import { currentSeq, dataEpoch } from '../models/Counter';
import { mutationSchema } from '../validation';
import type { AuthUser } from '../middleware/auth';
import { withLock } from './lock';
import { loadDoc, loadDocs, saveDoc } from './patientStore';
import { recordDecisions } from './auditService';
import { broadcastConflict, broadcastPatients } from './events';

export interface PushOptions {
  user: AuthUser;
  clientId: string;
  deviceName?: string;
  /** Socket id of the sender, so the broadcast skips it (it gets the ack instead). */
  exceptSocketId?: string;
}

export async function processMutations(rawMutations: unknown[], opts: PushOptions): Promise<PushResponse> {
  const results: MutationResult[] = [];
  const changed = new Map<string, PatientDoc>();
  const newConflicts: Conflict[] = [];

  for (const raw of rawMutations) {
    const rawId = typeof raw === 'object' && raw && 'id' in raw ? String((raw as { id: unknown }).id) : 'unknown';
    if (!WRITE_ROLES.includes(opts.user.role)) {
      results.push({ mutationId: rawId, status: 'rejected', reason: 'This role cannot edit patient records' });
      continue;
    }
    const parsed = mutationSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({ mutationId: rawId, status: 'rejected', reason: parsed.error.issues[0]?.message ?? 'Invalid mutation' });
      continue;
    }
    const mutation = {
      ...(parsed.data as unknown as Mutation),
      // The authenticated identity wins over whatever the device claims.
      userId: opts.user.userId,
      clientId: opts.clientId,
    };

    const result = await withLock(mutation.entityId, async (): Promise<MutationResult> => {
      const existing = await MutationLog.findById(mutation.id).lean();
      if (existing) {
        const status = existing.status === 'rejected' ? 'rejected' : existing.status === 'synced' ? 'synced' : 'conflict';
        return { mutationId: mutation.id, status };
      }

      const current = await loadDoc(mutation.entityId);
      const applied = applyMutation(current, mutation, { mode: 'server', newId: randomUUID });
      await saveDoc(applied.doc);
      const patientName = materialize(applied.doc).name;
      changed.set(applied.doc.id, applied.doc);

      const createdAt = new Date().toISOString();
      for (const draft of applied.conflicts) {
        const conflict: Conflict = { ...draft, patientName, status: 'pending_review', createdAt };
        await ConflictModel.create({ _id: conflict.id, ...conflict });
        newConflicts.push(conflict);
      }

      await recordDecisions(applied.decisions, { mutation, patientName });
      const status = applied.conflicts.length > 0 ? 'conflict' : 'synced';
      await MutationLog.create({
        _id: mutation.id,
        clientId: mutation.clientId,
        userId: mutation.userId,
        entityId: mutation.entityId,
        entityType: mutation.entityType,
        operation: mutation.operation,
        field: mutation.field,
        payload: mutation.payload,
        vectorClock: mutation.vectorClock,
        timestamp: mutation.timestamp,
        status,
        receivedAt: new Date(),
      });
      return { mutationId: mutation.id, status };
    });
    results.push(result);
  }

  await touchDevice(opts);
  const serverSeq = await currentSeq();
  const patients = [...changed.values()];
  broadcastPatients(patients, serverSeq, opts.exceptSocketId);
  for (const c of newConflicts) broadcastConflict(c);
  return { results, patients, serverSeq };
}

export async function pullChanges(since: number): Promise<PullResponse> {
  const serverSeq = await currentSeq();
  const patients = await loadDocs(since > 0 ? { seq: { $gt: since } } : {});
  return { patients, serverSeq, epoch: await dataEpoch() };
}

async function touchDevice(opts: PushOptions): Promise<void> {
  await DeviceModel.updateOne(
    { _id: opts.clientId },
    {
      $set: {
        userId: opts.user.userId,
        username: opts.user.username,
        ...(opts.user.facility ? { facility: opts.user.facility } : {}),
        lastSyncAt: new Date().toISOString(),
        ...(opts.deviceName ? { deviceName: opts.deviceName } : {}),
      },
    },
    { upsert: true },
  );
}

export { touchDevice };
