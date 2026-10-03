import { describe, expect, it } from 'vitest';
import { applyMutation, resolveMedicationConflict } from '../mergeEngine';
import { materialize } from '../materialize';
import { buildDeleteMutation } from '../diff';
import { FakeServer, baseInput, ctxFor, edit, newId, seed } from './helpers';

describe('merge engine: create and sequential edits', () => {
  it('creates a patient from one create mutation', () => {
    const server = new FakeServer();
    seed(server);
    const p = server.view();
    expect(p.name).toBe('Asha Patil');
    expect(p.allergies).toEqual([{ allergen: 'Penicillin', severity: 'severe', reaction: 'Rash' }]);
    expect(p.medications[0]).toMatchObject({ name: 'Metformin', dosage: '500 mg' });
    expect(p.vitals).toHaveLength(1);
    expect(server.decisions[0]).toMatchObject({ rule: 'create', outcome: 'applied' });
  });

  it('applies a sequential dosage change without a conflict', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const muts = edit(doc, { medications: [{ ...baseInput.medications[0], dosage: '850 mg' }] }, 'dev-b', '2026-10-01T11:00:00.000Z');
    expect(muts).toHaveLength(1);
    server.push(muts);
    expect(server.view().medications[0].dosage).toBe('850 mg');
    expect(server.conflicts).toHaveLength(0);
  });

  it('only emits mutations for fields that changed', () => {
    const server = new FakeServer();
    const doc = seed(server);
    expect(edit(doc, {}, 'dev-a', '2026-10-01T11:00:00.000Z')).toHaveLength(0);
    const muts = edit(doc, { contactNumber: '9811111111' }, 'dev-a', '2026-10-01T11:00:00.000Z');
    expect(muts.map((m) => m.field)).toEqual(['contactNumber']);
  });

  it('ignores a stale write that is older than the stored value', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const first = edit(doc, { name: 'Asha P.' }, 'dev-a', '2026-10-01T11:00:00.000Z');
    server.push(first);
    // Re-deliver an older clock for the same field
    const stale = { ...first[0], id: 'stale', payload: { value: 'Old Name' }, vectorClock: { 'dev-a': 1 } };
    server.push([stale]);
    expect(server.view().name).toBe('Asha P.');
    expect(server.decisions.at(-1)).toMatchObject({ outcome: 'kept_existing' });
  });
});

describe('merge engine: concurrent edits from two offline devices', () => {
  it('resolves concurrent name edits with Last-Write-Wins on timestamp', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const a = edit(doc, { name: 'Asha A' }, 'dev-a', '2026-10-01T12:00:00.000Z');
    const b = edit(doc, { name: 'Asha B' }, 'dev-b', '2026-10-01T12:05:00.000Z');
    server.push(b);
    server.push(a);
    expect(server.view().name).toBe('Asha B');
    expect(server.decisions.at(-1)!.report).toMatch(/Last-Write-Wins/);
  });

  it('LWW converges to the same value whatever order the server receives them', () => {
    const s1 = new FakeServer();
    const s2 = new FakeServer();
    const doc = seed(s1);
    seed(s2);
    const a = edit(doc, { bloodType: 'O+' }, 'dev-a', '2026-10-01T12:00:00.000Z');
    const b = edit(doc, { bloodType: 'AB-' }, 'dev-b', '2026-10-01T12:00:00.000Z');
    s1.push([...a, ...b]);
    s2.push([...b, ...a]);
    expect(s1.view().bloodType).toBe(s2.view().bloodType);
  });

  it('keeps allergies added on both devices (union, never lose)', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const base = baseInput.allergies;
    const a = edit(doc, { allergies: [...base, { allergen: 'Peanuts', severity: 'moderate', reaction: '' }] }, 'dev-a', '2026-10-01T12:00:00.000Z');
    const b = edit(doc, { allergies: [...base, { allergen: 'Latex', severity: 'mild', reaction: 'Itching' }] }, 'dev-b', '2026-10-01T12:01:00.000Z');
    server.push(a);
    server.push(b);
    expect(server.view().allergies.map((x) => x.allergen)).toEqual(['Latex', 'Peanuts', 'Penicillin']);
    expect(server.conflicts).toHaveLength(0);
  });

  it('an allergy removed on one device survives a concurrent update on another (add-wins)', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const remove = edit(doc, { allergies: [] }, 'dev-a', '2026-10-01T12:00:00.000Z');
    const update = edit(doc, { allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' }] }, 'dev-b', '2026-10-01T11:59:00.000Z');
    server.push(remove);
    server.push(update);
    expect(server.view().allergies).toEqual([{ allergen: 'Penicillin', severity: 'severe', reaction: 'Anaphylaxis' }]);
  });

  it('an explicit allergy removal applies when nothing concurrent happened', () => {
    const server = new FakeServer();
    const doc = seed(server);
    server.push(edit(doc, { allergies: [] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    expect(server.view().allergies).toEqual([]);
  });

  it('the same allergen added on both devices appears once', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const extra = { allergen: 'Sulfa', severity: 'mild' as const, reaction: '' };
    server.push(edit(doc, { allergies: [...baseInput.allergies, extra] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { allergies: [...baseInput.allergies, { ...extra, allergen: 'sulfa ' }] }, 'dev-b', '2026-10-01T12:00:00.000Z'));
    expect(server.view().allergies.filter((a) => a.allergen.toLowerCase() === 'sulfa')).toHaveLength(1);
  });

  it('routes concurrent different dosage edits to manual review and keeps the stored dose', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [{ ...med, dosage: '850 mg' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { medications: [{ ...med, dosage: '1000 mg' }] }, 'dev-b', '2026-10-01T12:30:00.000Z'));
    const view = server.view();
    expect(view.medications[0].dosage).toBe('850 mg');
    expect(view.medications[0].openConflictIds).toHaveLength(1);
    expect(view.hasOpenConflicts).toBe(true);
    expect(server.conflicts[0]).toMatchObject({
      key: 'metformin',
      currentValue: { dosage: '850 mg' },
      incomingValue: { dosage: '1000 mg' },
      incomingClientId: 'dev-b',
    });
    expect(server.decisions.at(-1)).toMatchObject({ outcome: 'conflict', rule: 'critical-review' });
  });

  it('flags a stop on one device concurrent with a dose change on another', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { medications: [{ ...med, dosage: '1000 mg' }] }, 'dev-b', '2026-10-01T12:30:00.000Z'));
    expect(server.conflicts).toHaveLength(1);
    // still visible because it has an open conflict
    expect(server.view().medications).toHaveLength(1);
  });

  it('does not flag concurrent edits that agree on the dose', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = { ...baseInput.medications[0], dosage: '850 mg' };
    server.push(edit(doc, { medications: [med] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { medications: [med] }, 'dev-b', '2026-10-01T12:30:00.000Z'));
    expect(server.conflicts).toHaveLength(0);
  });

  it('adds new medications from both devices without review', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [med, { name: 'Aspirin', dosage: '75 mg', frequency: 'daily', startDate: '', endDate: '' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { medications: [med, { name: 'Atorvastatin', dosage: '10 mg', frequency: 'nightly', startDate: '', endDate: '' }] }, 'dev-b', '2026-10-01T12:00:00.000Z'));
    expect(server.view().medications.map((m) => m.name)).toEqual(['Aspirin', 'Atorvastatin', 'Metformin']);
    expect(server.conflicts).toHaveLength(0);
  });

  it('changing only medication dates never causes a dosage conflict', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [{ ...med, dosage: '850 mg' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    const b = edit(doc, { medications: [{ ...med, startDate: '2026-09-01' }] }, 'dev-b', '2026-10-01T12:30:00.000Z');
    expect(b.map((m) => (m.payload as { op: string }).op)).toEqual(['setDetails']);
    server.push(b);
    expect(server.conflicts).toHaveLength(0);
    expect(server.view().medications[0]).toMatchObject({ dosage: '850 mg', startDate: '2026-09-01' });
  });

  it('keeps vitals readings from both devices', () => {
    const server = new FakeServer();
    const doc = seed(server);
    server.push(edit(doc, { newVitals: { heartRate: 80 } }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { newVitals: { temperature: 38.2 } }, 'dev-b', '2026-10-01T12:05:00.000Z'));
    const vitals = server.view().vitals;
    expect(vitals).toHaveLength(3);
    expect(vitals[0].temperature).toBe(38.2);
  });

  it('a device that pulled the latest copy edits sequentially, not concurrently', () => {
    const server = new FakeServer();
    seed(server);
    const med = baseInput.medications[0];
    server.push(edit(server.doc!, { medications: [{ ...med, dosage: '850 mg' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    // dev-b pulls the canonical doc, then edits
    server.push(edit(server.doc!, { medications: [{ ...med, dosage: '1000 mg' }] }, 'dev-b', '2026-10-01T12:30:00.000Z'));
    expect(server.conflicts).toHaveLength(0);
    expect(server.view().medications[0].dosage).toBe('1000 mg');
  });
});

describe('merge engine: manual resolution, delete and local mode', () => {
  it('a reviewer resolution dominates both conflicting writes', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [{ ...med, dosage: '850 mg' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    server.push(edit(doc, { medications: [{ ...med, dosage: '1000 mg' }] }, 'dev-b', '2026-10-01T12:30:00.000Z'));
    const c = server.conflicts[0];
    const { doc: resolved, decision } = resolveMedicationConflict(server.doc!, {
      conflictId: c.id,
      key: c.key,
      value: { dosage: '750 mg', frequency: 'twice daily', active: true },
      clocks: [c.currentClock, c.incomingClock],
      serverClientId: 'server',
      timestamp: '2026-10-01T13:00:00.000Z',
    });
    server.doc = resolved;
    expect(decision.outcome).toBe('resolved');
    const view = server.view();
    expect(view.medications[0]).toMatchObject({ dosage: '750 mg', openConflictIds: [] });
    // An old offline edit from dev-b that never saw the resolution is concurrent again,
    // but an edit made after pulling the resolution is sequential.
    server.push(edit(server.doc!, { medications: [{ ...med, dosage: '800 mg' }] }, 'dev-b', '2026-10-01T14:00:00.000Z'));
    expect(server.conflicts).toHaveLength(1);
    expect(server.view().medications[0].dosage).toBe('800 mg');
  });

  it('soft deletes a patient', () => {
    const server = new FakeServer();
    const doc = seed(server);
    server.push([buildDeleteMutation(doc, ctxFor('dev-a', '2026-10-01T12:00:00.000Z'))]);
    expect(server.view().deleted).toBe(true);
  });

  it('local mode applies a concurrent dosage edit optimistically', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const med = baseInput.medications[0];
    server.push(edit(doc, { medications: [{ ...med, dosage: '850 mg' }] }, 'dev-a', '2026-10-01T12:00:00.000Z'));
    const b = edit(doc, { medications: [{ ...med, dosage: '1000 mg' }] }, 'dev-b', '2026-10-01T12:30:00.000Z');
    const local = applyMutation(server.doc, b[0], { mode: 'local', newId });
    expect(materialize(local.doc).medications[0].dosage).toBe('1000 mg');
    expect(local.conflicts).toHaveLength(0);
  });

  it('never mutates the input document', () => {
    const server = new FakeServer();
    const doc = seed(server);
    const snapshot = JSON.stringify(doc);
    applyMutation(doc, edit(doc, { name: 'X' }, 'dev-a', '2026-10-01T12:00:00.000Z')[0], { mode: 'server', newId });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
