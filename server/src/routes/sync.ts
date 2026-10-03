import { Router } from 'express';
import { pushSchema } from '../validation';
import { processMutations, pullChanges } from '../services/syncService';

/** REST fallback for the Socket.io sync channel (same service underneath). */
export const syncRouter = Router();

syncRouter.post('/push', async (req, res) => {
  const body = pushSchema.parse(req.body);
  const response = await processMutations(body.mutations, {
    user: req.user!,
    clientId: body.clientId,
    deviceName: body.deviceName,
  });
  res.json(response);
});

syncRouter.get('/pull', async (req, res) => {
  const since = Number(req.query.since ?? 0);
  res.json(await pullChanges(Number.isFinite(since) ? since : 0));
});
