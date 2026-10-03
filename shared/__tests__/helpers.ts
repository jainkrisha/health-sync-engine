import { applyMutation } from '../mergeEngine';
import { buildCreateMutation, buildUpdateMutations, type MutationContext, type PatientInput } from '../diff';
import { materialize } from '../materialize';
import type { Mutation, PatientDoc } from '../types';

let counter = 0;
export const newId = () => `id-${++counter}`;

export function ctxFor(clientId: string, now: string): MutationContext {
  return { clientId, userId: `user-${clientId}`, userName: clientId, now, newId };
}

export const baseInput: PatientInput = {
  name: 'Asha Patil',
  dateOfBirth: '1990-04-12',
  gender: 'female',
  bloodType: 'B+',
  contactNumber: '9800000000',
  allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Rash' }],
  medications: [{ name: 'Metformin', dosage: '500 mg', frequency: 'twice daily', startDate: '', endDate: '' }],
  newVitals: { heartRate: 72, bloodPressure: '120/80' },
};

/** A tiny in-memory "server" that runs the engine in server mode. */
export class FakeServer {
  doc: PatientDoc | null = null;
  conflicts: ReturnType<typeof applyMutation>['conflicts'] = [];
  decisions: ReturnType<typeof applyMutation>['decisions'] = [];

  push(mutations: Mutation[]) {
    for (const m of mutations) {
      const r = applyMutation(this.doc, m, { mode: 'server', newId });
      this.doc = r.doc;
      this.conflicts.push(...r.conflicts);
      this.decisions.push(...r.decisions);
    }
    return this.doc!;
  }

  view() {
    return materialize(this.doc!);
  }
}

export function edit(doc: PatientDoc, change: Partial<PatientInput>, clientId: string, now: string) {
  const current = materialize(doc);
  const input: PatientInput = {
    name: current.name,
    dateOfBirth: current.dateOfBirth,
    gender: current.gender,
    bloodType: current.bloodType,
    contactNumber: current.contactNumber,
    allergies: current.allergies,
    medications: current.medications.map(({ openConflictIds: _o, ...m }) => m),
    newVitals: null,
    ...change,
  };
  return buildUpdateMutations(doc, input, ctxFor(clientId, now));
}

export function seed(server: FakeServer) {
  const create = buildCreateMutation('p1', baseInput, ctxFor('dev-a', '2026-10-01T10:00:00.000Z'));
  return server.push([create]);
}
