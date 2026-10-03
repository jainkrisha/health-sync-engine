import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User';
import { loginSchema, registerSchema } from '../validation';
import { requireAuth, signToken } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { config } from '../config';
import type { Role } from '@shared/types';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  if (!config.allowOpenRegistration) throw new HttpError(403, 'Registration is disabled, ask an administrator');
  const body = registerSchema.parse(req.body);
  const exists = await User.findOne({ username: body.username.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'That username is already taken');
  const user = await User.create({
    username: body.username,
    name: body.name || body.username,
    passwordHash: await bcrypt.hash(body.password, 10),
    role: body.role,
  });
  const publicUser = toPublicUser(user.toObject());
  const token = signToken({ userId: publicUser.id, username: publicUser.username, name: publicUser.name, role: publicUser.role });
  res.status(201).json({ token, role: publicUser.role, user: publicUser });
});

authRouter.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ username: body.username.toLowerCase() }).lean();
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect username or password');
  }
  const publicUser = toPublicUser(user);
  const token = signToken({ userId: user._id, username: user.username, name: user.name, role: user.role as Role });
  res.json({ token, role: publicUser.role, user: publicUser });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).lean();
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: toPublicUser(user) });
});
