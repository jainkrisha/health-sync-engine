import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { buildCreateMutation, buildUpdateMutations, type PatientInput } from '@shared/diff';
import { materialize } from '@shared/materialize';
import type { Conflict, PatientDoc, PushResponse } from '@shared/types';
import { AuditEntryModel } from '../src/models/AuditEntry';
import { startTestServer } from './setup';

let server: Awaited<ReturnType<typeof startTestServer>>;
const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};

const input: PatientInput = {
  name: 'Test Patient',
  dateOfBirth: '1990-01-01',
  gender: 'female',
  bloodType: 'A+',
  contactNumber: '',
  allergies: [{ allergen: 'Penicillin', severity: 'severe', reaction: 'Rash' }],
  medications: [{ name: 'Metformin', dosage: '500 mg', frequency: 'daily', startDate: '', endDate: '' }],
  newVitals: null,
};

function ctx(clientId: string, user: string, now: string) {
  return { clientId, userId: userIds[user], userName: user, now, newId: randomUUID };
}

function viewInput(doc: PatientDoc): PatientInput {
  const p = materialize(doc);
  return { ...input, name: p.name, allergies: p.allergies, medications: p.medications.map(({ openConflictIds: _o, ...m }) => m) };
}

async function push(user: string, clientId: string, mutations: unknown[]): Promise<PushResponse> {
  const res = await request(server.app)
    .post('/api/sync/push')
    .set('Authorization', `Bearer ${tokens[user]}`)
    .send({ clientId, mutations });
  expect(res.status).toBe(200);
  return res.body as PushResponse;
}

beforeAll(async () => {
  server = await startTestServer();
  for (const [username, role] of [
    ['worker1', 'health_worker'],
    ['worker2', 'health_worker'],
    ['reviewer', 'clinical_reviewer'],
    ['auditor', 'auditor'],
    ['admin', 'admin'],
  ] as const) {
    const res = await request(server.app).post('/api/auth/register').send({ username, password: 'password123', role });
    expect(res.status).toBe(201);
    tokens[username] = res.body.token;
    userIds[username] = res.body.user.id;
  }
});

afterAll(async () => {
  await server?.stop();
});

describe('auth and roles', () => {
  it('logs in and returns the role', async () => {
    const res = await request(server.app).post('/api/auth/login').send({ username: 'reviewer', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('clinical_reviewer');
    expect(res.body.token).toBeTruthy();
  });

  it('rejects a wrong password and a duplicate username', async () => {
    expect((await request(server.app).post('/api/auth/login').send({ username: 'reviewer', password: 'nope' })).status).toBe(401);
    expect((await request(server.app).post('/api/auth/register').send({ username: 'reviewer', password: 'password123', role: 'admin' })).status).toBe(409);
  });

  it('opens an account only in its own portal (PHC or district admin)', async () => {
    const login = (username: string, portal: string) =>
      request(server.app).post('/api/auth/login').send({ username, password: 'password123', portal });
    const wrong = await login('reviewer', 'phc');
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toMatch(/Admin \(District Hospital\)/);
    expect((await login('reviewer', 'district')).status).toBe(200);

    const phc = await request(server.app)
      .post('/api/auth/register')
      .send({ username: 'phcdoc', name: 'Dr. Local', password: 'password123', role: 'health_worker', portal: 'phc', facility: 'PHC Wagholi' });
    expect(phc.status).toBe(201);
    expect(phc.body.user.facility).toBe('PHC Wagholi');
    expect((await login('phcdoc', 'district')).status).toBe(403);
    expect((await login('phcdoc', 'phc')).status).toBe(200);

    const noPhcName = await request(server.app)
      .post('/api/auth/register')
      .send({ username: 'phcdoc2', password: 'password123', role: 'health_worker', portal: 'phc' });
    expect(noPhcName.status).toBe(400);
    const badRole = await request(server.app)
      .post('/api/auth/register')
      .send({ username: 'phcadmin', password: 'password123', role: 'admin', portal: 'phc', facility: 'PHC X' });
    expect(badRole.status).toBe(400);
  });

  it('requires a token for patient routes', async () => {
    expect((await request(server.app).get('/api/patients')).status).toBe(401);
    expect((await request(server.app).get('/api/patients').set('Authorization', 'Bearer junk')).status).toBe(401);
  });

  it('limits the audit log to auditors and admins', async () => {
    const as = (u: string) => request(server.app).get('/api/audit-log').set('Authorization', `Bearer ${tokens[u]}`);
    expect((await as('worker1')).status).toBe(403);
    expect((await as('reviewer')).status).toBe(403);
    expect((await as('auditor')).status).toBe(200);
    expect((await as('admin')).status).toBe(200);
  });

  it('limits conflicts to reviewers and admins, users to admins', async () => {
    const get = (path: string, u: string) => request(server.app).get(path).set('Authorization', `Bearer ${tokens[u]}`);
    expect((await get('/api/conflicts', 'worker1')).status).toBe(403);
    expect((await get('/api/conflicts', 'reviewer')).status).toBe(200);
    expect((await get('/api/users', 'reviewer')).status).toBe(403);
    expect((await get('/api/users', 'admin')).status).toBe(200);
  });
});

describe('sync and merge', () => {
  let doc: PatientDoc;
  const patientId = randomUUID();

  it('accepts a create mutation and is idempotent on redelivery', async () => {
    const m = buildCreateMutation(patientId, input, ctx('dev-a', 'worker1', '2026-10-01T10:00:00.000Z'));
    const first = await push('worker1', 'dev-a', [m]);
    expect(first.results).toEqual([{ mutationId: m.id, status: 'synced' }]);
    doc = first.patients[0];
    expect(materialize(doc).name).toBe('Test Patient');
    const again = await push('worker1', 'dev-a', [m]);
    expect(again.results[0].status).toBe('synced');
    expect(again.patients).toHaveLength(0);
  });

  it('rejects malformed mutations and writes from auditors', async () => {
    const bad = await push('worker1', 'dev-a', [{ id: 'x', entityType: 'patient', operation: 'update', field: 'name' }]);
    expect(bad.results[0].status).toBe('rejected');
    const m = buildUpdateMutations(doc, { ...viewInput(doc), name: 'Auditor edit' }, ctx('dev-z', 'auditor', '2026-10-01T10:01:00.000Z'));
    const res = await push('auditor', 'dev-z', m);
    expect(res.results[0]).toMatchObject({ status: 'rejected' });
  });

  it('pulls only what changed since a sequence number', async () => {
    const res = await request(server.app).get('/api/sync/pull?since=0').set('Authorization', `Bearer ${tokens.worker2}`);
    expect(res.body.patients.map((p: PatientDoc) => p.id)).toContain(patientId);
    const none = await request(server.app).get(`/api/sync/pull?since=${res.body.serverSeq}`).set('Authorization', `Bearer ${tokens.worker2}`);
    expect(none.body.patients).toHaveLength(0);
  });

  it('merges concurrent offline edits: allergies union, dosage to review', async () => {
    const base = viewInput(doc);
    const fromA = buildUpdateMutations(
      doc,
      { ...base, allergies: [...base.allergies, { allergen: 'Latex', severity: 'mild', reaction: '' }], medications: [{ ...base.medications[0], dosage: '850 mg' }] },
      ctx('dev-a', 'worker1', '2026-10-01T11:00:00.000Z'),
    );
    const fromB = buildUpdateMutations(
      doc,
      { ...base, allergies: [...base.allergies, { allergen: 'Peanuts', severity: 'severe', reaction: '' }], medications: [{ ...base.medications[0], dosage: '1000 mg' }] },
      ctx('dev-b', 'worker2', '2026-10-01T11:05:00.000Z'),
    );
    await push('worker1', 'dev-a', fromA);
    const resB = await push('worker2', 'dev-b', fromB);
    expect(resB.results.map((r) => r.status)).toContain('conflict');
    const merged = materialize(resB.patients[0]);
    expect(merged.allergies.map((a) => a.allergen)).toEqual(['Latex', 'Peanuts', 'Penicillin']);
    expect(merged.medications[0]).toMatchObject({ dosage: '850 mg' });
    expect(merged.hasOpenConflicts).toBe(true);
    doc = resB.patients[0];
  });

  it('lets a reviewer resolve the conflict and audits it', async () => {
    const list = await request(server.app).get('/api/conflicts').set('Authorization', `Bearer ${tokens.reviewer}`);
    const conflict = (list.body.conflicts as Conflict[]).find((c) => c.patientId === patientId)!;
    expect(conflict).toMatchObject({ status: 'pending_review', currentValue: { dosage: '850 mg' }, incomingValue: { dosage: '1000 mg' } });

    const res = await request(server.app)
      .post(`/api/conflicts/${conflict.id}/resolve`)
      .set('Authorization', `Bearer ${tokens.reviewer}`)
      .send({ choice: 'custom', value: { dosage: '750 mg', frequency: 'daily', active: true }, note: 'Checked with doctor' });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toMatchObject({ status: 'resolved', resolution: 'custom', resolvedValue: { dosage: '750 mg' } });

    const again = await request(server.app)
      .post(`/api/conflicts/${conflict.id}/resolve`)
      .set('Authorization', `Bearer ${tokens.reviewer}`)
      .send({ choice: 'current' });
    expect(again.status).toBe(409);

    const patient = await request(server.app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${tokens.worker1}`);
    expect(patient.body.patient.medications[0]).toMatchObject({ dosage: '750 mg', openConflictIds: [] });

    const audit = await request(server.app).get(`/api/audit-log?patientId=${patientId}&type=manual`).set('Authorization', `Bearer ${tokens.auditor}`);
    expect(audit.body.entries).toHaveLength(1);
    expect(audit.body.entries[0]).toMatchObject({ resolvedByName: 'reviewer', rule: 'manual-review' });
    expect(audit.body.entries[0].report).toMatch(/Checked with doctor/);
  });

  it('keeps the audit trail append-only', async () => {
    await expect(AuditEntryModel.updateOne({}, { $set: { report: 'tampered' } })).rejects.toThrow(/append-only/);
    await expect(AuditEntryModel.deleteMany({})).rejects.toThrow(/append-only/);
  });

  it('reports dashboard stats', async () => {
    const res = await request(server.app).get('/api/stats').set('Authorization', `Bearer ${tokens.worker1}`);
    expect(res.body.patients).toBeGreaterThanOrEqual(1);
    expect(res.body.conflicts).toMatchObject({ pending: 0, resolved: 1 });
    expect(res.body.resolutions.manual).toBe(1);
    expect(res.body.mutationsByDay).toHaveLength(7);
  });

  it('lists PHCs for the district only', async () => {
    const worker = await request(server.app).get('/api/phcs').set('Authorization', `Bearer ${tokens.worker1}`);
    expect(worker.status).toBe(403);
    const res = await request(server.app).get('/api/phcs').set('Authorization', `Bearer ${tokens.admin}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.phcs)).toBe(true);
    for (const phc of res.body.phcs) {
      expect(phc).toMatchObject({ name: expect.any(String), patientCount: expect.any(Number) });
      expect(phc.activity).toHaveLength(7);
    }
  });
});

describe('REST patient routes', () => {
  it('creates, updates and archives a patient through the API', async () => {
    const auth = { Authorization: `Bearer ${tokens.worker1}` };
    const created = await request(server.app).post('/api/patients').set(auth).send({ ...input, name: 'API Patient' });
    expect(created.status).toBe(201);
    const id = created.body.patient.id;
    const updated = await request(server.app).put(`/api/patients/${id}`).set(auth).send({ ...input, name: 'API Patient 2' });
    expect(updated.body.patient.name).toBe('API Patient 2');
    expect((await request(server.app).delete(`/api/patients/${id}`).set(auth)).status).toBe(204);
    const list = await request(server.app).get('/api/patients').set(auth);
    expect(list.body.patients.map((p: { id: string }) => p.id)).not.toContain(id);
    const auditor = await request(server.app).post('/api/patients').set('Authorization', `Bearer ${tokens.auditor}`).send(input);
    expect(auditor.status).toBe(403);
  });
});

describe('socket.io real-time sync', () => {
  const sockets: Socket[] = [];
  afterAll(() => sockets.forEach((s) => s.close()));

  function open(user: string, clientId: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const s = connect(server.url, { auth: { token: tokens[user], clientId }, transports: ['websocket'] });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  }

  it('rejects a connection without a valid token', async () => {
    const s = connect(server.url, { auth: { token: 'junk', clientId: 'x' }, transports: ['websocket'] });
    sockets.push(s);
    const err = await new Promise<Error>((resolve) => s.on('connect_error', resolve));
    expect(err.message).toMatch(/token/i);
  });

  it('acks the sender and broadcasts the merged patient to other devices', async () => {
    const a = await open('worker1', 'sock-a');
    const b = await open('worker2', 'sock-b');
    const reviewer = await open('reviewer', 'sock-r');
    const id = randomUUID();
    const m = buildCreateMutation(id, { ...input, name: 'Socket Patient' }, ctx('sock-a', 'worker1', new Date().toISOString()));

    const broadcast = new Promise<{ patient: PatientDoc }>((resolve) => b.on('patient:changed', resolve));
    const ackEvent = new Promise<{ mutationIds: string[] }>((resolve) => a.on('sync:ack', resolve));
    const response = await new Promise<PushResponse>((resolve) => a.emit('mutation:push', { mutations: [m] }, resolve));

    expect(response.results[0]).toMatchObject({ mutationId: m.id, status: 'synced' });
    expect((await ackEvent).mutationIds).toEqual([m.id]);
    expect(materialize((await broadcast).patient).name).toBe('Socket Patient');

    // Concurrent dosage edits => reviewers are notified live.
    const doc = response.patients[0];
    const conflictEvent = new Promise<{ conflict: Conflict }>((resolve) => reviewer.on('conflict:changed', resolve));
    const fromA = buildUpdateMutations(doc, { ...viewInput(doc), medications: [{ ...input.medications[0], dosage: '1 g' }] }, ctx('sock-a', 'worker1', new Date().toISOString()));
    const fromB = buildUpdateMutations(doc, { ...viewInput(doc), medications: [{ ...input.medications[0], dosage: '2 g' }] }, ctx('sock-b', 'worker2', new Date().toISOString()));
    await new Promise((resolve) => a.emit('mutation:push', { mutations: fromA }, resolve));
    await new Promise((resolve) => b.emit('mutation:push', { mutations: fromB }, resolve));
    const { conflict } = await conflictEvent;
    expect(conflict).toMatchObject({ patientId: id, label: 'Metformin', status: 'pending_review' });

    const pulled = await new Promise<{ patients: PatientDoc[] }>((resolve) => b.emit('sync:pull', { since: 0 }, resolve));
    expect(pulled.patients.some((p) => p.id === id)).toBe(true);
  });
});
