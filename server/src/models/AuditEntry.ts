import { Schema, model } from 'mongoose';

/** Append-only audit trail of every merge decision. Updates and deletes are blocked. */
const auditSchema = new Schema(
  {
    _id: { type: String, required: true },
    mutationId: { type: String, default: null, index: true },
    conflictId: { type: String, default: null },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, default: '' },
    field: { type: String, required: true },
    key: { type: String },
    rule: { type: String, required: true },
    outcome: { type: String, required: true },
    resolutionType: { type: String, enum: ['automatic', 'manual'], required: true },
    report: { type: String, required: true },
    finalValue: { type: Schema.Types.Mixed },
    concurrent: { type: Boolean, default: false },
    clientId: { type: String, default: null },
    userId: { type: String, default: null },
    resolvedBy: { type: String, default: null },
    resolvedByName: { type: String, default: null },
    timestamp: { type: String, required: true, index: true },
  },
  { versionKey: false },
);

function appendOnly(): never {
  throw new Error('The audit trail is append-only');
}
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
] as const) {
  auditSchema.pre(op, appendOnly);
}
auditSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('The audit trail is append-only'));
  next();
});

export const AuditEntryModel = model('AuditEntry', auditSchema);
