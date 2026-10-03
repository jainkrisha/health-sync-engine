import { describe, expect, it } from 'vitest';
import {
  compare,
  createVectorClock,
  deserialize,
  dominates,
  increment,
  merge,
  serialize,
} from '../vectorClock';

describe('vectorClock', () => {
  it('creates a clock with a zero counter', () => {
    expect(createVectorClock('a')).toEqual({ a: 0 });
  });

  it('increments without mutating the input', () => {
    const c = { a: 1 };
    expect(increment(c, 'a')).toEqual({ a: 2 });
    expect(increment(c, 'b')).toEqual({ a: 1, b: 1 });
    expect(c).toEqual({ a: 1 });
  });

  it('merges as the component-wise max', () => {
    expect(merge({ a: 3, b: 1 }, { a: 1, b: 4, c: 2 })).toEqual({ a: 3, b: 4, c: 2 });
  });

  it('compares before, after, equal and concurrent', () => {
    expect(compare({ a: 1 }, { a: 2 })).toBe('before');
    expect(compare({ a: 2, b: 1 }, { a: 1 })).toBe('after');
    expect(compare({ a: 1, b: 0 }, { a: 1 })).toBe('equal');
    expect(compare({ a: 2 }, { b: 1 })).toBe('concurrent');
    expect(compare({ a: 2, b: 1 }, { a: 1, b: 2 })).toBe('concurrent');
    expect(dominates({ a: 2, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(dominates({ a: 2 }, { b: 1 })).toBe(false);
  });

  it('round-trips through JSON and rejects bad input', () => {
    const clock = { b: 2, a: 1 };
    expect(serialize(clock)).toBe('{"a":1,"b":2}');
    expect(deserialize(serialize(clock))).toEqual(clock);
    expect(() => deserialize('[1]')).toThrow();
    expect(() => deserialize('{"a":-1}')).toThrow();
    expect(() => deserialize('{"a":"x"}')).toThrow();
  });
});
