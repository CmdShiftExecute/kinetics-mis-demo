import { describe, expect, test } from 'bun:test';
import { AED_COMPACT_GUIDE, k, mil, signedK } from '../src/lib/format';

describe('AED amounts stored in thousands', () => {
  test('uses compact units for tables and charts', () => {
    expect(k(785)).toBe('785k');
    expect(k(1_250)).toBe('1.3m');
    expect(k(135_000)).toBe('135m');
    expect(k(1_250_000)).toBe('1.3bn');
    expect(signedK(1_250)).toBe('+1.3m');
    expect(signedK(-1_250)).toBe('−1.3m');
  });

  test('adds AED to compact executive headline figures', () => {
    expect(mil(785)).toBe('AED 785k');
    expect(mil(135_000)).toBe('AED 135m');
    expect(mil(1_250_000)).toBe('AED 1.3bn');
  });

  test('provides one plain-language unit guide for every page', () => {
    expect(AED_COMPACT_GUIDE).toBe('AED · k = thousand · m = million · bn = billion');
  });
});
