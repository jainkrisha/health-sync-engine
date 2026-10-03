/**
 * db.ts — on-device storage (IndexedDB via Dexie).
 *
 * Tables
 * - patients: one row per patient. The CRDT documents are stored encrypted:
 *     base  = the last canonical copy received from the server (null until synced)
 *     local = base + this device's pending edits (what the UI shows)
 * - outbox:   mutations made on this device, oldest first, until the server acks them.
 *             Synced entries are kept for a while for the dashboard chart.
 * - meta:     small key/value settings (last server sequence number, etc.)
 * - keys:     this device's non-extractable AES-GCM key.
 */

import Dexie, { type Table } from 'dexie';
import { databaseName } from '../lib/deviceProfile';
import type { EncryptedBlob } from '../crypto/encryption';
import type { MutationStatus } from '@shared/types';

export interface PatientRow {
  id: string;
  updatedAt: string;
  enc: EncryptedBlob;
}

export interface OutboxRow {
  id: string;
  entityId: string;
  /** Monotonic order so mutations are always pushed in the order they were made. */
  order: number;
  status: MutationStatus;
  createdAt: string;
  syncedAt?: string;
  reason?: string;
  enc: EncryptedBlob;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface KeyRow {
  id: string;
  key: CryptoKey;
}

export class HealthSyncDB extends Dexie {
  patients!: Table<PatientRow, string>;
  outbox!: Table<OutboxRow, string>;
  meta!: Table<MetaRow, string>;
  keys!: Table<KeyRow, string>;

  constructor(name = databaseName) {
    super(name);
    this.version(1).stores({
      patients: 'id, updatedAt',
      outbox: 'id, entityId, order, status, createdAt, syncedAt',
      meta: 'key',
      keys: 'id',
    });
  }
}

export const db = new HealthSyncDB();

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
