import { Schema, model } from 'mongoose';

const deviceSchema = new Schema(
  {
    _id: { type: String, required: true }, // clientId
    deviceName: { type: String, default: 'Unknown device' },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    lastSyncAt: { type: String, required: true },
  },
  { versionKey: false },
);

export const DeviceModel = model('Device', deviceSchema);
