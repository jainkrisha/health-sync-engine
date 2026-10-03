/**
 * mutationLog.ts — the device's outbox of field-level mutations.
 * Payloads are encrypted at rest like patient records.
 */
import { db, type OutboxRow } from './db';
import { getDeviceKey } from '../crypto/deviceKey';
import { decryptJson, encryptJson } from '../crypto/encryption';
import type { Mutation, MutationResult } from '@shared/types';

let orderCounter = 0;
function nextOrder(): number {
  orderCounter = (orderCounter + 1) % 1000;
  return Date.now() * 1000 + orderCounter;
}

export async function queueMutations(mutations: Mutation[]): Promise<void> {
  const key = await getDeviceKey();
  const rows: OutboxRow[] = [];
  for (const m of mutations) {
    rows.push({
      id: m.id,
      entityId: m.entityId,
      order: nextOrder(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      enc: await encryptJson(m, key),
    });
  }
  await db.outbox.bulkAdd(rows);
}

async function decryptRows(rows: OutboxRow[]): Promise<Mutation[]> {
  const key = await getDeviceKey();
  return Promise.all(rows.map((r) => decryptJson<Mutation>(r.enc, key)));
}

/** Pending mutations in the order they were made. */
export async function getPendingMutations(entityId?: string): Promise<Mutation[]> {
  const rows = await db.outbox.orderBy('order').filter((r) => r.status === 'pending' && (!entityId || r.entityId === entityId)).toArray();
  return decryptRows(rows);
}

export async function countPending(): Promise<number> {
  return db.outbox.where('status').equals('pending').count();
}

/** Record what the server decided for each pushed mutation. */
export async function markMutationResults(results: MutationResult[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.outbox, async () => {
    for (const r of results) {
      await db.outbox.update(r.mutationId, { status: r.status, syncedAt: now, reason: r.reason });
    }
  });
}

/** Kept for compatibility with the task split: mark ids as synced. */
export async function markMutationsSynced(ids: string[]): Promise<void> {
  await markMutationResults(ids.map((mutationId) => ({ mutationId, status: 'synced' })));
}

export interface OutboxSummary {
  id: string;
  entityId: string;
  status: OutboxRow['status'];
  createdAt: string;
  syncedAt?: string;
  reason?: string;
}

export async function getOutboxSince(sinceIso: string): Promise<OutboxSummary[]> {
  const rows = await db.outbox.where('createdAt').aboveOrEqual(sinceIso).toArray();
  return rows.map(({ enc: _enc, order: _order, ...rest }) => rest);
}

export async function getRejectedMutations(): Promise<OutboxSummary[]> {
  const rows = await db.outbox.where('status').equals('rejected').toArray();
  return rows.map(({ enc: _enc, order: _order, ...rest }) => rest);
}

/** Drop acknowledged entries older than 30 days so the outbox does not grow forever. */
export async function pruneOutbox(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  await db.outbox.where('syncedAt').below(cutoff).delete();
}

/** Patient ids that still have edits waiting to reach the server (no decryption needed). */
export async function getPendingEntityIds(): Promise<Set<string>> {
  const rows = await db.outbox.where('status').equals('pending').toArray();
  return new Set(rows.map((r) => r.entityId));
}
