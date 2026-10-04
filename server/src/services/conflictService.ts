import { resolveMedicationConflict } from '@shared/mergeEngine';
import { materialize } from '@shared/materialize';
import type { Conflict, ConflictChoice, MedicationCritical } from '@shared/types';
import type { VectorClock } from '@shared/vectorClock';
import { ConflictModel } from '../models/Conflict';
import { MutationLog } from '../models/MutationLog';
import { currentSeq } from '../models/Counter';
import { HttpError } from '../middleware/error';
import type { AuthUser } from '../middleware/auth';
import { config } from '../config';
import { withLock } from './lock';
import { loadDoc, saveDoc } from './patientStore';
import { recordManualResolution } from './auditService';
import { broadcastConflict, broadcastPatients } from './events';

type ConflictRow = Omit<Conflict, 'id'> & { _id: string };

export function toConflict(row: ConflictRow): Conflict {
  const { _id, ...rest } = row;
  return { ...rest, id: _id };
}

export async function resolveConflict(
  conflictId: string,
  input: { choice: ConflictChoice; value?: MedicationCritical; note?: string },
  user: AuthUser,
): Promise<Conflict> {
  const row = await ConflictModel.findById(conflictId).lean<ConflictRow>();
  if (!row) throw new HttpError(404, 'Conflict not found');
  if (row.status !== 'pending_review') throw new HttpError(409, 'This conflict has already been resolved');

  let value: MedicationCritical;
  if (input.choice === 'current') value = row.currentValue;
  else if (input.choice === 'incoming') value = row.incomingValue;
  else if (input.value) value = input.value;
  else throw new HttpError(400, 'A custom resolution needs a value');

  return withLock(row.patientId, async () => {
    const doc = await loadDoc(row.patientId);
    if (!doc) throw new HttpError(404, 'Patient not found');
    const now = new Date().toISOString();
    const { doc: next, decision } = resolveMedicationConflict(doc, {
      conflictId,
      key: row.key,
      value,
      clocks: [row.currentClock as VectorClock, row.incomingClock as VectorClock],
      serverClientId: config.serverClientId,
      timestamp: now,
    });
    await saveDoc(next);
    const patientName = materialize(next).name;

    await ConflictModel.updateOne(
      { _id: conflictId },
      {
        $set: {
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: user.userId,
          resolvedByName: user.name || user.username,
          resolution: input.choice,
          resolvedValue: value,
          note: input.note ?? '',
          patientName,
        },
      },
    );
    await MutationLog.updateOne({ _id: row.mutationId }, { $set: { status: 'resolved' } });
    await recordManualResolution({
      decision: input.note ? { ...decision, report: `${decision.report} Note: ${input.note}` } : decision,
      conflictId,
      mutationId: row.mutationId,
      patientId: row.patientId,
      patientName,
      userId: user.userId,
      userName: user.name || user.username,
    });

    const updated = toConflict((await ConflictModel.findById(conflictId).lean<ConflictRow>())!);
    broadcastPatients([next], await currentSeq());
    broadcastConflict(updated);
    return updated;
  });
}
