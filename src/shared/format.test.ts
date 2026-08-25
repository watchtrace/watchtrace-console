import { describe, expect, it } from 'vitest';
import { formatPercent } from './format';

describe('reliability formatting', () => {
  it('never presents a missing denominator as perfect uptime', () => {
    expect(formatPercent(null)).toBe('No data');
    expect(formatPercent(undefined)).toBe('No data');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1)).toBe('100%');
  });
});
