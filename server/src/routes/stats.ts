import { Router } from 'express';
import type { StatsResponse } from '@shared/types';
import { PatientModel } from '../models/Patient';
import { MutationLog } from '../models/MutationLog';
import { ConflictModel } from '../models/Conflict';
import { AuditEntryModel } from '../models/AuditEntry';
import { DeviceModel } from '../models/Device';

export const statsRouter = Router();

statsRouter.get('/', async (_req, res) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);

  const [patients, recent, pending, resolved, automatic, manual, devices] = await Promise.all([
    PatientModel.countDocuments({ deleted: false }),
    MutationLog.find({ receivedAt: { $gte: since } }, { receivedAt: 1, status: 1 }).lean(),
    ConflictModel.countDocuments({ status: 'pending_review' }),
    ConflictModel.countDocuments({ status: 'resolved' }),
    AuditEntryModel.countDocuments({ resolutionType: 'automatic', concurrent: true, outcome: { $ne: 'conflict' } }),
    AuditEntryModel.countDocuments({ resolutionType: 'manual' }),
    DeviceModel.countDocuments(),
  ]);

  const days = new Map<string, { synced: number; conflicts: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    days.set(d.toISOString().slice(0, 10), { synced: 0, conflicts: 0 });
  }
  for (const m of recent) {
    const day = days.get(new Date(m.receivedAt).toISOString().slice(0, 10));
    if (!day) continue;
    if (m.status === 'synced' || m.status === 'resolved') day.synced++;
    else if (m.status === 'conflict') day.conflicts++;
  }

  const body: StatsResponse = {
    patients,
    mutationsByDay: [...days.entries()].map(([date, v]) => ({ date, ...v })),
    conflicts: { pending, resolved },
    resolutions: { automatic, manual },
    devices,
  };
  res.json(body);
});
