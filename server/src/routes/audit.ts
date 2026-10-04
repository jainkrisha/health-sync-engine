import { Router } from "express";
import type { AuditEntry, Conflict, HistoryCommit } from "@shared/types";
import { AuditEntryModel } from "../models/AuditEntry";
import { ConflictModel } from "../models/Conflict";
import { DeviceModel } from "../models/Device";
import { MutationLog } from "../models/MutationLog";
import { User } from "../models/User";
import { toConflict } from "../services/conflictService";

export const auditRouter = Router();

/** Read-only. There is intentionally no route that edits or deletes audit entries. */
auditRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.patientId) filter.patientId = String(req.query.patientId);
  if (req.query.type === "automatic" || req.query.type === "manual")
    filter.resolutionType = req.query.type;
  if (req.query.outcome) filter.outcome = String(req.query.outcome);
  if (req.query.concurrentOnly === "true") filter.concurrent = true;
  const range: Record<string, string> = {};
  if (req.query.from)
    range.$gte = new Date(String(req.query.from)).toISOString();
  if (req.query.to) {
    const to = new Date(String(req.query.to));
    // A bare date (YYYY-MM-DD) means the whole UTC day; a full timestamp is used as is.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to)))
      to.setUTCHours(23, 59, 59, 999);
    range.$lte = to.toISOString();
  }
  if (Object.keys(range).length) filter.timestamp = range;
  const limit = Math.min(Number(req.query.limit ?? 200) || 200, 1000);
  const entries = await AuditEntryModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
  res.json({ entries: entries.map(({ _id, ...e }) => ({ ...e, id: _id })) });
});

/**
 * One patient's history as commits: every mutation a device pushed, with its
 * vector clock (so the client can draw the causal graph), the merge decisions it
 * produced, and the conflicts it raised or that a reviewer settled.
 */
auditRouter.get("/history/:patientId", async (req, res) => {
  const patientId = req.params.patientId;
  const [mutations, entries, conflictRows] = await Promise.all([
    MutationLog.find({ entityId: patientId }).sort({ receivedAt: 1 }).lean(),
    AuditEntryModel.find({ patientId }).sort({ timestamp: 1 }).lean(),
    ConflictModel.find({ patientId })
      .sort({ createdAt: 1 })
      .lean<(Omit<Conflict, "id"> & { _id: string })[]>(),
  ]);
  const clientIds = [...new Set(mutations.map((m) => m.clientId))];
  const userIds = [...new Set(mutations.map((m) => m.userId))];
  const [devices, users] = await Promise.all([
    DeviceModel.find(
      { _id: { $in: clientIds } },
      { deviceName: 1, facility: 1 },
    ).lean(),
    User.find({ _id: { $in: userIds } }, { name: 1, username: 1 }).lean(),
  ]);
  const deviceName = new Map(devices.map((d) => [String(d._id), d.deviceName]));
  const userName = new Map(
    users.map((u) => [String(u._id), u.name || u.username]),
  );
  const decisions = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!e.mutationId || e.resolutionType !== "automatic") continue;
    decisions.set(e.mutationId, [...(decisions.get(e.mutationId) ?? []), e]);
  }
  const commits: HistoryCommit[] = mutations.map((m) => ({
    id: String(m._id),
    clientId: m.clientId,
    deviceName: deviceName.get(m.clientId) ?? "Unknown device",
    userName: userName.get(m.userId) ?? "Unknown user",
    operation: m.operation,
    field: (m.field ?? null) as HistoryCommit["field"],
    payload: m.payload ?? {},
    vectorClock: m.vectorClock,
    timestamp: m.timestamp,
    receivedAt: new Date(m.receivedAt).toISOString(),
    status: m.status,
    decisions: (decisions.get(String(m._id)) ?? []).map(
      ({ _id, ...e }) => ({ ...e, id: String(_id) }) as unknown as AuditEntry,
    ),
  }));
  res.json({
    patientName:
      entries.at(-1)?.patientName ?? conflictRows.at(-1)?.patientName ?? "",
    commits,
    conflicts: conflictRows.map(toConflict),
  });
});
