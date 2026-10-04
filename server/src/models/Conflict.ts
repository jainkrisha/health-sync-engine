import { Schema, model } from 'mongoose';

const critical = {
  dosage: { type: String, default: '' },
  frequency: { type: String, default: '' },
  active: { type: Boolean, default: true },
};

const conflictSchema = new Schema(
  {
    _id: { type: String, required: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, default: '' },
    field: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    currentValue: critical,
    currentClock: { type: Schema.Types.Mixed, default: {} },
    currentClientId: { type: String, default: '' },
    currentTimestamp: { type: String, default: '' },
    incomingValue: critical,
    incomingClock: { type: Schema.Types.Mixed, default: {} },
    incomingClientId: { type: String, required: true },
    incomingTimestamp: { type: String, required: true },
    mutationId: { type: String, required: true },
    status: { type: String, enum: ['pending_review', 'resolved'], default: 'pending_review', index: true },
    createdAt: { type: String, required: true },
    resolvedAt: { type: String },
    resolvedBy: { type: String },
    resolvedByName: { type: String },
    resolution: { type: String, enum: ['current', 'incoming', 'custom'] },
    resolvedValue: { type: new Schema(critical, { _id: false }), default: undefined },
    note: { type: String },
  },
  { versionKey: false },
);

export const ConflictModel = model('Conflict', conflictSchema);
