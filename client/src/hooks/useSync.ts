import { useSyncExternalStore } from 'react';
import { syncEngine, type SyncState } from '../sync/syncEngine';

/** Live sync state: { status, pendingCount, lastSyncedAt, triggerSync, ... } */
export function useSyncEngine(): SyncState & {
  triggerSync: () => Promise<void>;
  setSimulatedOffline: (v: boolean) => void;
} {
  const state = useSyncExternalStore(
    (cb) => syncEngine.subscribe(cb),
    () => syncEngine.state,
  );
  return {
    ...state,
    triggerSync: () => syncEngine.triggerSync(),
    setSimulatedOffline: (v: boolean) => syncEngine.setSimulatedOffline(v),
  };
}
