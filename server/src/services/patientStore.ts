import { materialize } from '@shared/materialize';
import type { PatientDoc } from '@shared/types';
import { PatientModel } from '../models/Patient';
import { nextSeq } from '../models/Counter';

export async function loadDoc(id: string): Promise<PatientDoc | null> {
  const row = await PatientModel.findById(id).lean();
  return row ? (JSON.parse(row.docJson) as PatientDoc) : null;
}

export async function saveDoc(doc: PatientDoc): Promise<number> {
  const seq = await nextSeq();
  const view = materialize(doc);
  await PatientModel.updateOne(
    { _id: doc.id },
    {
      $set: {
        docJson: JSON.stringify(doc),
        name: view.name,
        deleted: view.deleted,
        hasOpenConflicts: view.hasOpenConflicts,
        seq,
        updatedAt: doc.updatedAt,
      },
    },
    { upsert: true },
  );
  return seq;
}

export async function loadDocs(filter: Record<string, unknown> = {}): Promise<PatientDoc[]> {
  const rows = await PatientModel.find(filter).sort({ seq: 1 }).lean();
  return rows.map((r) => JSON.parse(r.docJson) as PatientDoc);
}
