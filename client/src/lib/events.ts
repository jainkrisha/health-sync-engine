/**
 * events.ts — "local data changed" notifications so hooks re-read IndexedDB.
 * A BroadcastChannel carries the same signal to other tabs of the same device.
 */
import { deviceProfile } from './deviceProfile';

type Listener = () => void;
const listeners = new Set<Listener>();

let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(`healthsync-data-${deviceProfile}`);
  channel.onmessage = () => listeners.forEach((l) => l());
} catch {
  channel = null;
}

export function notifyDataChanged(): void {
  listeners.forEach((l) => l());
  channel?.postMessage('changed');
}

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
