import { Schema, model, type InferSchemaType } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ROLES, type PublicUser, type Role } from '@shared/types';

const userSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
  },
  { timestamps: true, versionKey: false },
);

export type UserRecord = InferSchemaType<typeof userSchema> & { _id: string };
export const User = model('User', userSchema);

export function toPublicUser(u: { _id: string; username: string; name: string; role: string; createdAt?: Date }): PublicUser {
  return {
    id: u._id,
    username: u.username,
    name: u.name,
    role: u.role as Role,
    createdAt: (u.createdAt ?? new Date()).toISOString(),
  };
}
