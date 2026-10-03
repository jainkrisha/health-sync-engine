import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '@shared/types';
import { User, toPublicUser } from '../models/User';
import { DeviceModel } from '../models/Device';
import { HttpError } from '../middleware/error';
import { onlineClientIds } from '../socket';

export const usersRouter = Router();

usersRouter.get('/', async (_req, res) => {
  const users = await User.find().sort({ createdAt: 1 }).lean();
  res.json({ users: users.map(toPublicUser) });
});

usersRouter.patch('/:id/role', async (req, res) => {
  const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body);
  if (req.params.id === req.user!.userId && role !== 'admin') {
    throw new HttpError(400, 'You cannot remove your own admin role');
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role } }, { new: true }).lean();
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: toPublicUser(user) });
});

export const devicesRouter = Router();

devicesRouter.get('/', async (_req, res) => {
  const online = onlineClientIds();
  const devices = await DeviceModel.find().sort({ lastSyncAt: -1 }).lean();
  res.json({
    devices: devices.map((d) => ({
      clientId: d._id,
      deviceName: d.deviceName,
      userId: d.userId,
      username: d.username,
      lastSyncAt: d.lastSyncAt,
      online: online.has(d._id),
    })),
  });
});
