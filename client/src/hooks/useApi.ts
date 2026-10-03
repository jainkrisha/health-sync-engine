import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

interface State<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/**
 * Fetch JSON from the API. Refetches when `path` or `refreshKey` changes, or
 * when reload() is called. `loading` is true until the current request settles.
 */
export function useApi<T>(path: string | null, refreshKey?: unknown) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: null, error: null });
  const key = path ? `${path}|${String(refreshKey)}|${nonce}` : null;

  useEffect(() => {
    if (!path || !key) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setState((prev) => ({ key, data: prev.data, error: err instanceof ApiError ? err.message : 'Request failed' }));
      });
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((update: (prev: T | null) => T | null) => {
    setState((prev) => ({ ...prev, data: update(prev.data) }));
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: key !== null && state.key !== key,
    reload,
    setData,
  };
}
