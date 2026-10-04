import { Schema, model } from 'mongoose';

const counterSchema = new Schema({ _id: { type: String, required: true }, value: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = model('Counter', counterSchema);

export async function nextSeq(name = 'patients'): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return doc!.value;
}

export async function currentSeq(name = 'patients'): Promise<number> {
  const doc = await Counter.findById(name).lean();
  return doc?.value ?? 0;
}

/**
 * A random number fixed for the life of this database. It changes when the
 * database is reset, which tells devices to drop their old copies.
 */
export async function dataEpoch(): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: 'epoch' }, { $setOnInsert: { value: Math.floor(Math.random() * 2 ** 31) } }, { upsert: true, new: true });
  return doc!.value;
}
