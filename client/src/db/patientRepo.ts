/**
 * patientRepo.ts — every read and write of patient records on the device.
 *
 * Local edits are applied immediately (optimistic, "local" merge mode) and
 * queued in the outbox. When the server sends a canonical copy, it becomes the
 * new base and any still-pending local edits are re-applied on top of it.
 */
import { applyMutation } from '@shared/mergeEngine';
import { materialize } from '@shared/materialize';
import type { Mutation, Patient, PatientDoc } from '@shared/types';
import { db } from './db';
import { getDeviceKey } from '../crypto/deviceKey';
import { decryptJson, encryptJson } from '../crypto/encryption';
import { getPendingEntityIds, getPendingMutations, queueMutations } from './mutationLog';
import { notifyDataChanged } from '../lib/events';
import { Mutex } from '../lib/mutex';

interface StoredPatient {
  base: PatientDoc | null;
  local: PatientDoc;
}

const writeLock = new Mutex();
const localCtx = { mode: 'local' as const, newId: () => crypto.randomUUID() };

async function readStored(id: string): Promise<StoredPatient | null> {
  const row = await db.patients.get(id);
  if (!row) return null;
  return decryptJson<StoredPatient>(row.enc, await getDeviceKey());
}

async function writeStored(stored: StoredPatient): Promise<void> {
  const enc = await encryptJson(stored, await getDeviceKey());
  await db.patients.put({ id: stored.local.id, updatedAt: stored.local.updatedAt, enc });
}

export async function getAllPatientDocs(): Promise<PatientDoc[]> {
  const key = await getDeviceKey();
  const rows = await db.patients.toArray();
  const stored = await Promise.all(rows.map((r) => decryptJson<StoredPatient>(r.enc, key)));
  return stored.map((s) => s.local);
}

export async function getAllPatients(): Promise<Patient[]> {
  const docs = await getAllPatientDocs();
  return docs
    .map(materialize)
    .filter((p) => !p.deleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPatientDoc(id: string): Promise<PatientDoc | null> {
  return (await readStored(id))?.local ?? null;
}

export async function getPatientById(id: string): Promise<Patient | undefined> {
  const doc = await getPatientDoc(id);
  return doc ? materialize(doc) : undefined;
}

/**
 * Apply an edit made on this device and queue it for sync. The mutations are
 * built inside the write lock from the latest local copy, so two quick saves
 * can never reuse the same vector clock counter.
 */
export async function commitLocalEdit(
  entityId: string,
  build: (current: PatientDoc | null) => Mutation[],
): Promise<Mutation[]> {
  const mutations = await writeLock.run(async () => {
    const stored = await readStored(entityId);
    const list = build(stored?.local ?? null);
    if (list.length === 0) return list;
    let local: PatientDoc | null = stored?.local ?? null;
    for (const m of list) local = applyMutation(local, m, localCtx).doc;
    await writeStored({ base: stored?.base ?? null, local: local! });
    await queueMutations(list);
    return list;
  });
  if (mutations.length > 0) notifyDataChanged();
  return mutations;
}

/** Take canonical copies from the server and rebase pending local edits on them. */
export async function applyServerDocs(docs: PatientDoc[]): Promise<void> {
  if (docs.length === 0) return;
  await writeLock.run(async () => {
    for (const doc of docs) {
      const pending = await getPendingMutations(doc.id);
      let local = doc;
      for (const m of pending) local = applyMutation(local, m, localCtx).doc;
      await writeStored({ base: doc, local });
    }
  });
  notifyDataChanged();
}

/**
 * The server's database was reset (its sequence went backwards): forget every
 * synced copy, so the next full pull replaces them. Records with edits still
 * waiting to sync are kept and will be pushed again.
 */
export async function dropSyncedPatients(): Promise<void> {
  await writeLock.run(async () => {
    const keep = await getPendingEntityIds();
    const ids = (await db.patients.toCollection().primaryKeys()) as string[];
    await db.patients.bulkDelete(ids.filter((id) => !keep.has(id)));
  });
  notifyDataChanged();
}

export async function hasLocalData(): Promise<boolean> {
  return (await db.patients.count()) > 0;
}
