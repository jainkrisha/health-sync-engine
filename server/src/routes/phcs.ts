/**
 * PHC directory for the district: one summary per Primary Health Centre —
 * its staff, devices, patients registered there, recent sync activity and
 * open dose conflicts raised from its devices.
 */
import { Router } from 'express';
import { DISTRICT_FACILITY, type PhcSummary } from '@shared/types';
import { User } from '../models/User';
import { DeviceModel } from '../models/Device';
import { MutationLog } from '../models/MutationLog';
import { PatientModel } from '../models/Patient';
import { ConflictModel } from '../models/Conflict';
import { onlineClientIds } from '../socket';

export const phcsRouter = Router();

phcsRouter.get('/', async (_req, res) => {
  const [users, devices, creates, pendingConflicts] = await Promise.all([
    User.find({ facility: { $ne: DISTRICT_FACILITY } }).lean(),
    DeviceModel.find().lean(),
    MutationLog.find({ operation: 'create', entityType: 'patient' }, { clientId: 1, entityId: 1, receivedAt: 1 }).lean(),
    ConflictModel.find({ status: 'pending_review' }, { currentClientId: 1, incomingClientId: 1, patientName: 1, label: 1, createdAt: 1 }).lean(),
  ]);
  const online = onlineClientIds();

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recent = await MutationLog.find({ receivedAt: { $gte: since } }, { clientId: 1, receivedAt: 1, status: 1 }).lean();

  const facilityOfClient = new Map<string, string>();
  for (const d of devices) facilityOfClient.set(d._id as unknown as string, d.facility || '');

  const facilities = new Set<string>();
  for (const u of users) if (u.facility) facilities.add(u.facility);
  for (const d of devices) if (d.facility && d.facility !== DISTRICT_FACILITY) facilities.add(d.facility);

  const patientIdsByFacility = new Map<string, { id: string; at: Date }[]>();
  for (const c of creates) {
    const f = facilityOfClient.get(c.clientId);
    if (!f) continue;
    const list = patientIdsByFacility.get(f) ?? [];
    list.push({ id: c.entityId, at: c.receivedAt });
    patientIdsByFacility.set(f, list);
  }
  const allIds = [...patientIdsByFacility.values()].flat().map((p) => p.id);
  const patients = await PatientModel.find({ _id: { $in: allIds } }, { name: 1, deleted: 1, hasOpenConflicts: 1, updatedAt: 1 }).lean();
  const patientById = new Map(patients.map((p) => [p._id as unknown as string, p]));

  const summaries: PhcSummary[] = [...facilities].sort().map((name) => {
    const staff = users.filter((u) => u.facility === name);
    const devs = devices.filter((d) => d.facility === name);
    const devIds = new Set(devs.map((d) => d._id as unknown as string));
    const created = (patientIdsByFacility.get(name) ?? [])
      .map((p) => ({ ...p, doc: patientById.get(p.id) }))
      .filter((p) => p.doc && !p.doc.deleted);
    const days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      days.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    let syncedThisWeek = 0;
    for (const m of recent) {
      if (!devIds.has(m.clientId)) continue;
      syncedThisWeek++;
      const key = new Date(m.receivedAt).toISOString().slice(0, 10);
      const day = days.find((d) => d.date === key);
      if (day) day.count++;
    }
    const conflicts = pendingConflicts.filter((c) => devIds.has(c.currentClientId) || devIds.has(c.incomingClientId));
    const lastSyncAt = devs.reduce<string | null>((max, d) => (!max || d.lastSyncAt > max ? d.lastSyncAt : max), null);
    const firstSeen = staff.reduce<string | null>((min, u) => {
      const c = (u.createdAt as Date | undefined)?.toISOString() ?? null;
      return c && (!min || c < min) ? c : min;
    }, null);

    return {
      name,
      staff: staff.map((u) => ({ name: u.name, username: u.username, role: u.role })),
      devices: devs.map((d) => ({
        clientId: d._id as unknown as string,
        deviceName: d.deviceName,
        username: d.username,
        lastSyncAt: d.lastSyncAt,
        online: online.has(d._id as unknown as string),
      })),
      patientCount: created.length,
      recentPatients: created
        .sort((a, b) => (b.doc!.updatedAt > a.doc!.updatedAt ? 1 : -1))
        .slice(0, 6)
        .map((p) => ({ id: p.id, name: p.doc!.name, updatedAt: p.doc!.updatedAt, needsReview: Boolean(p.doc!.hasOpenConflicts) })),
      activity: days,
      syncedThisWeek,
      openConflicts: conflicts.map((c) => ({ patientName: c.patientName, label: c.label, createdAt: c.createdAt })),
      lastSyncAt,
      since: firstSeen,
    };
  });

  res.json({ phcs: summaries });
});
