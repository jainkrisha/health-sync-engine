import { useEffect, useState } from 'react';
import { getPendingEntityIds } from '../db/mutationLog';
import { onDataChanged } from '../lib/events';
import { useSyncEngine } from './useSync';

/** Ids of patients with local edits not yet acknowledged by the server. */
export function usePendingIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const { pendingCount } = useSyncEngine();
  useEffect(() => {
    const load = () => void getPendingEntityIds().then(setIds).catch(() => undefined);
    load();
    return onDataChanged(load);
  }, [pendingCount]);
  return ids;
}
