import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, toPublicUser } from '../models/User';
import { loginSchema, registerSchema } from '../validation';
import { requireAuth, signToken } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { config } from '../config';
import { DISTRICT_FACILITY, PORTAL_LABELS, PORTAL_ROLES, portalForRole, type PublicUser } from '@shared/types';

function tokenFor(u: PublicUser): string {
  return signToken({ userId: u.id, username: u.username, name: u.name, role: u.role, facility: u.facility });
}

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  if (!config.allowOpenRegistration) throw new HttpError(403, 'Registration is disabled, ask an administrator');
  const body = registerSchema.parse(req.body);
  const portal = body.portal ?? portalForRole(body.role);
  if (!PORTAL_ROLES[portal].includes(body.role)) {
    throw new HttpError(400, `A ${PORTAL_LABELS[portal]} account cannot have that role`);
  }
  // The sign-in screen always sends the PHC name; plain API clients may leave it out.
  const facility = portal === 'district' ? DISTRICT_FACILITY : body.facility?.trim() || (body.portal ? '' : 'Unassigned PHC');
  if (!facility) throw new HttpError(400, 'Enter the name of your PHC');
  const exists = await User.findOne({ username: body.username.toLowerCase() }).lean();
  if (exists) throw new HttpError(409, 'That username is already taken');
  const user = await User.create({
    username: body.username,
    name: body.name || body.username,
    passwordHash: await bcrypt.hash(body.password, 10),
    role: body.role,
    facility,
  });
  const publicUser = toPublicUser(user.toObject());
  const token = tokenFor(publicUser);
  res.status(201).json({ token, role: publicUser.role, user: publicUser });
});

authRouter.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await User.findOne({ username: body.username.toLowerCase() }).lean();
  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, 'Incorrect username or password');
  }
  const publicUser = toPublicUser(user);
  // The sign-in screen asks whether this is a PHC or the district hospital. An
  // account only opens in its own portal, so a PHC login never lands in the
  // central system and vice versa.
  if (body.portal && portalForRole(publicUser.role) !== body.portal) {
    const right = PORTAL_LABELS[portalForRole(publicUser.role)];
    throw new HttpError(403, `This is a ${right} account. Choose ${right} above and sign in again.`);
  }
  const token = tokenFor(publicUser);
  res.json({ token, role: publicUser.role, user: publicUser });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).lean();
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: toPublicUser(user) });
});
