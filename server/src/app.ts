import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AUDIT_ROLES, PORTAL_ROLES, REVIEW_ROLES } from '@shared/types';
import { config } from './config';
import { requireAuth, requireRole } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { patientsRouter } from './routes/patients';
import { syncRouter } from './routes/sync';
import { conflictsRouter } from './routes/conflicts';
import { auditRouter } from './routes/audit';
import { usersRouter, devicesRouter } from './routes/users';
import { statsRouter } from './routes/stats';
import { phcsRouter } from './routes/phcs';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => {
  const up = mongoose.connection.readyState === 1;

  res
    .status(up ? 200 : 503)
    .json({
      ok: up,
      time: new Date().toISOString(),
    });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/patients', requireAuth, patientsRouter);
  app.use('/api/sync', requireAuth, syncRouter);
  app.use('/api/conflicts', requireAuth, requireRole(...REVIEW_ROLES), conflictsRouter);
  app.use('/api/audit-log', requireAuth, requireRole(...AUDIT_ROLES), auditRouter);
  app.use('/api/users', requireAuth, requireRole('admin'), usersRouter);
  app.use('/api/devices', requireAuth, requireRole('admin'), devicesRouter);
  app.use('/api/stats', requireAuth, statsRouter);
  app.use('/api/phcs', requireAuth, requireRole(...PORTAL_ROLES.district), phcsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
