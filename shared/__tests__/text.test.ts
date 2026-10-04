import { describe, expect, it } from 'vitest';
import { plural, todayLocal } from '../text';

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'allergy', 'allergies')).toBe('1 allergy');
    expect(plural(0, 'allergy', 'allergies')).toBe('0 allergies');
    expect(plural(3, 'change')).toBe('3 changes');
  });
});

describe('todayLocal', () => {
  it('returns the local calendar date, not the UTC one', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayLocal()).toBe(expected);
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
