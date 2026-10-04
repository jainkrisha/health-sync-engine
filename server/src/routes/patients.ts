import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { materialize } from '@shared/materialize';
import { buildCreateMutation, buildDeleteMutation, buildUpdateMutations, type MutationContext } from '@shared/diff';
import { WRITE_ROLES, REVIEW_ROLES, AUDIT_ROLES } from '@shared/types';
import { requireRole } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { patientInputSchema } from '../validation';
import { loadDoc, loadDocs } from '../services/patientStore';
import { processMutations } from '../services/syncService';
import { AuditEntryModel } from '../models/AuditEntry';
import { config } from '../config';
import type { Request } from 'express';

export const patientsRouter = Router();

function apiContext(req: Request): MutationContext {
  return {
    clientId: config.serverClientId,
    userId: req.user!.userId,
    userName: req.user!.name || req.user!.username,
    now: new Date().toISOString(),
    newId: randomUUID,
  };
}

patientsRouter.get('/', async (req, res) => {
  const includeDeleted = req.query.includeDeleted === 'true';
  const docs = await loadDocs(includeDeleted ? {} : { deleted: false });
  res.json({ patients: docs.map(materialize) });
});

patientsRouter.get('/:id', async (req, res) => {
  const doc = await loadDoc(String(req.params.id));
  if (!doc) throw new HttpError(404, 'Patient not found');
  res.json({ patient: materialize(doc), doc });
});

patientsRouter.get('/:id/history', requireRole(...new Set([...REVIEW_ROLES, ...AUDIT_ROLES])), async (req, res) => {
  const entries = await AuditEntryModel.find({ patientId: req.params.id }).sort({ timestamp: -1 }).limit(200).lean();
  res.json({ entries: entries.map(({ _id, ...e }) => ({ ...e, id: _id })) });
});

patientsRouter.post('/', requireRole(...WRITE_ROLES), async (req, res) => {
  const input = patientInputSchema.parse(req.body);
  const id = randomUUID();
  const mutation = buildCreateMutation(id, input, apiContext(req));
  const result = await processMutations([mutation], { user: req.user!, clientId: config.serverClientId });
  const doc = result.patients[0];
  res.status(201).json({ patient: materialize(doc), results: result.results });
});

patientsRouter.put('/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  const doc = await loadDoc(String(req.params.id));
  if (!doc) throw new HttpError(404, 'Patient not found');
  const input = patientInputSchema.parse(req.body);
  const mutations = buildUpdateMutations(doc, input, apiContext(req));
  const result = await processMutations(mutations, { user: req.user!, clientId: config.serverClientId });
  const next = result.patients[0] ?? doc;
  res.json({ patient: materialize(next), results: result.results });
});

patientsRouter.delete('/:id', requireRole(...WRITE_ROLES), async (req, res) => {
  const doc = await loadDoc(String(req.params.id));
  if (!doc) throw new HttpError(404, 'Patient not found');
  const mutation = buildDeleteMutation(doc, apiContext(req));
  await processMutations([mutation], { user: req.user!, clientId: config.serverClientId });
  res.status(204).end();
});
