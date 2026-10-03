import { Router } from 'express';
import { ConflictModel } from '../models/Conflict';
import { HttpError } from '../middleware/error';
import { resolveSchema } from '../validation';
import { resolveConflict, toConflict } from '../services/conflictService';
import type { Conflict } from '@shared/types';

export const conflictsRouter = Router();

type Row = Omit<Conflict, 'id'> & { _id: string };

conflictsRouter.get('/', async (req, res) => {
  const status = String(req.query.status ?? 'pending_review');
  const filter: Record<string, unknown> = {};
  if (status !== 'all') filter.status = status;
  if (req.query.patientId) filter.patientId = String(req.query.patientId);
  const rows = await ConflictModel.find(filter).sort({ createdAt: -1 }).limit(500).lean<Row[]>();
  res.json({ conflicts: rows.map(toConflict) });
});

conflictsRouter.get('/:id', async (req, res) => {
  const row = await ConflictModel.findById(req.params.id).lean<Row>();
  if (!row) throw new HttpError(404, 'Conflict not found');
  res.json({ conflict: toConflict(row) });
});

conflictsRouter.post('/:id/resolve', async (req, res) => {
  const body = resolveSchema.parse(req.body);
  const conflict = await resolveConflict(req.params.id, body, req.user!);
  res.json({ conflict });
});
