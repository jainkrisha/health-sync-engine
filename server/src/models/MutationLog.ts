import { Schema, model } from 'mongoose';

/** Every mutation a device pushed, exactly once (the id makes delivery idempotent). */
const mutationLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    clientId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    entityId: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    operation: { type: String, enum: ['create', 'update', 'delete'], required: true },
    field: { type: String },
    payload: { type: Schema.Types.Mixed },
    vectorClock: { type: Schema.Types.Mixed, required: true },
    timestamp: { type: String, required: true },
    status: { type: String, enum: ['synced', 'conflict', 'resolved', 'rejected'], required: true },
    receivedAt: { type: Date, required: true, index: true },
  },
  { versionKey: false },
);

export const MutationLog = model('MutationLog', mutationLogSchema);
