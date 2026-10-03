import { Schema, model } from 'mongoose';

/**
 * Canonical patient record. The full CRDT document (with a vector clock on every
 * field) is stored as JSON text: its keys are user data (allergen and medication
 * names) which can contain characters MongoDB does not allow in field names.
 * A few top-level fields are copied out for querying.
 */
const patientSchema = new Schema(
  {
    _id: { type: String, required: true },
    docJson: { type: String, required: true },
    name: { type: String, default: '' },
    deleted: { type: Boolean, default: false },
    hasOpenConflicts: { type: Boolean, default: false },
    /** Global change sequence number, used by devices to pull only what changed. */
    seq: { type: Number, required: true, index: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false },
);

export const PatientModel = model('Patient', patientSchema);
