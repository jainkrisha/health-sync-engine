import { Schema, model, type InferSchemaType } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { DISTRICT_FACILITY, ROLES, portalForRole, type PublicUser, type Role } from '@shared/types';

const userSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    facility: { type: String, default: '', trim: true },
  },
  { timestamps: true, versionKey: false },
);

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: string };
export const User = model('User', userSchema);

export function toPublicUser(u: {
  _id: string;
  username: string;
  name: string;
  role: string;
  facility?: string | null;
  createdAt?: Date;
}): PublicUser {
  const role = u.role as Role;
  return {
    id: u._id,
    username: u.username,
    name: u.name,
    role,
    facility: u.facility || (portalForRole(role) === 'district' ? DISTRICT_FACILITY : 'Unassigned PHC'),
    createdAt: (u.createdAt ?? new Date()).toISOString(),
  };
}
