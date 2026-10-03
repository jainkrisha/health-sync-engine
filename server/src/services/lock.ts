/**
 * Per-key async lock so two mutations for the same patient are never merged at
 * the same time (each merge is read, apply, write). Single-process only, which
 * matches the single server container in docker-compose.
 */
const tails = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => (release = resolve));
  const tail = previous.then(() => current);
  tails.set(key, tail);
  try {
    await previous;
    return await fn();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}
