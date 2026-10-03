import { randomUUID } from 'node:crypto';
import type { MergeDecision, Mutation } from '@shared/types';
import { AuditEntryModel } from '../models/AuditEntry';

export async function recordDecisions(
  decisions: MergeDecision[],
  ctx: { mutation: Mutation; patientName: string },
): Promise<void> {
  if (decisions.length === 0) return;
  const now = new Date().toISOString();
  await AuditEntryModel.insertMany(
    decisions.map((d) => ({
      _id: randomUUID(),
      mutationId: ctx.mutation.id,
      conflictId: null,
      patientId: ctx.mutation.entityId,
      patientName: ctx.patientName,
      field: d.field,
      key: d.key,
      rule: d.rule,
      outcome: d.outcome,
      resolutionType: 'automatic',
      report: d.report,
      finalValue: d.finalValue,
      concurrent: d.concurrent,
      clientId: ctx.mutation.clientId,
      userId: ctx.mutation.userId,
      resolvedBy: null,
      resolvedByName: null,
      timestamp: now,
    })),
  );
}

export async function recordManualResolution(input: {
  decision: MergeDecision;
  conflictId: string;
  mutationId: string;
  patientId: string;
  patientName: string;
  userId: string;
  userName: string;
}): Promise<void> {
  await AuditEntryModel.create({
    _id: randomUUID(),
    mutationId: input.mutationId,
    conflictId: input.conflictId,
    patientId: input.patientId,
    patientName: input.patientName,
    field: input.decision.field,
    key: input.decision.key,
    rule: input.decision.rule,
    outcome: input.decision.outcome,
    resolutionType: 'manual',
    report: input.decision.report,
    finalValue: input.decision.finalValue,
    concurrent: true,
    clientId: null,
    userId: input.userId,
    resolvedBy: input.userId,
    resolvedByName: input.userName,
    timestamp: new Date().toISOString(),
  });
}
