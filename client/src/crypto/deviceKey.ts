import { db } from '../db/db';
import { generateKey } from './encryption';

let cached: Promise<CryptoKey> | null = null;

/** The device's AES-GCM key, created on first use and kept non-extractable in IndexedDB. */
export function getDeviceKey(): Promise<CryptoKey> {
  if (!cached) {
    cached = (async () => {
      const existing = await db.keys.get('device');
      if (existing) return existing.key;
      const key = await generateKey();
      await db.keys.put({ id: 'device', key });
      return key;
    })().catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}
