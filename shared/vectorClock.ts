/**
 * vectorClock.ts — pure vector clock helpers shared by the client and the server.
 *
 * A vector clock is a map of { [clientId]: counter }. Every device increments its
 * own counter on each local write, and merges in any clock it receives. Comparing
 * two clocks tells us whether one write happened after the other or whether they
 * are concurrent (a genuine conflict).
 */

export type VectorClock = Record<string, number>;

export type ClockOrder = 'before' | 'after' | 'concurrent' | 'equal';

export function createVectorClock(clientId: string): VectorClock {
  return { [clientId]: 0 };
}

export function increment(clock: VectorClock, clientId: string): VectorClock {
  return { ...clock, [clientId]: (clock[clientId] ?? 0) + 1 };
}

/** Component-wise max of both clocks. */
export function merge(a: VectorClock, b: VectorClock): VectorClock {
  const result: VectorClock = { ...a };
  for (const [id, counter] of Object.entries(b)) {
    result[id] = Math.max(result[id] ?? 0, counter);
  }
  return result;
}

export function mergeAll(...clocks: VectorClock[]): VectorClock {
  return clocks.reduce<VectorClock>((acc, c) => merge(acc, c), {});
}

/**
 * Compare clock A against clock B.
 * - "before":     A happened before B (B has seen everything A has, and more)
 * - "after":      A happened after B
 * - "concurrent": neither has seen the other's latest write — a true conflict
 * - "equal":      identical histories
 */
export function compare(a: VectorClock, b: VectorClock): ClockOrder {
  let aGreater = false;
  let bGreater = false;
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const av = a[id] ?? 0;
    const bv = b[id] ?? 0;
    if (av > bv) aGreater = true;
    if (bv > av) bGreater = true;
  }
  if (aGreater && bGreater) return 'concurrent';
  if (aGreater) return 'after';
  if (bGreater) return 'before';
  return 'equal';
}

/** True when `a` has seen everything in `b` (after or equal). */
export function dominates(a: VectorClock, b: VectorClock): boolean {
  const order = compare(a, b);
  return order === 'after' || order === 'equal';
}

export function serialize(clock: VectorClock): string {
  const sorted: VectorClock = {};
  for (const id of Object.keys(clock).sort()) sorted[id] = clock[id];
  return JSON.stringify(sorted);
}

export function deserialize(json: string): VectorClock {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid vector clock JSON');
  }
  const clock: VectorClock = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid counter for ${id} in vector clock`);
    }
    clock[id] = value;
  }
  return clock;
}

/** Short human-readable form, e.g. "A3f2:4, 9bc1:2". */
export function formatClock(clock: VectorClock): string {
  const entries = Object.entries(clock).filter(([, v]) => v > 0);
  if (entries.length === 0) return '∅';
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, v]) => `${id.slice(0, 6)}:${v}`)
    .join(', ');
}
