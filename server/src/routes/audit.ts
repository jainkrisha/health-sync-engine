import { Router } from 'express';
import { AuditEntryModel } from '../models/AuditEntry';

export const auditRouter = Router();

/** Read-only. There is intentionally no route that edits or deletes audit entries. */
auditRouter.get('/', async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.patientId) filter.patientId = String(req.query.patientId);
  if (req.query.type === 'automatic' || req.query.type === 'manual') filter.resolutionType = req.query.type;
  if (req.query.outcome) filter.outcome = String(req.query.outcome);
  if (req.query.concurrentOnly === 'true') filter.concurrent = true;
  const range: Record<string, string> = {};
  if (req.query.from) range.$gte = new Date(String(req.query.from)).toISOString();
  if (req.query.to) {
    const to = new Date(String(req.query.to));
    // A bare date (YYYY-MM-DD) means the whole UTC day; a full timestamp is used as is.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) to.setUTCHours(23, 59, 59, 999);
    range.$lte = to.toISOString();
  }
  if (Object.keys(range).length) filter.timestamp = range;
  const limit = Math.min(Number(req.query.limit ?? 200) || 200, 1000);
  const entries = await AuditEntryModel.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  res.json({ entries: entries.map(({ _id, ...e }) => ({ ...e, id: _id })) });
});
