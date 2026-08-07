import { describe, expect, it } from 'vitest';
import { formatDateTimeMinute } from './formatDateTime';

describe('formatDateTimeMinute', () => {
  it('formats a full ISO timestamp to minute precision', () => {
    // `new Date('2026-08-07T14:30:00.123')` parses in the local timezone,
    // so the expectation stays stable regardless of the test machine TZ.
    const date = new Date(2026, 7, 7, 14, 30, 0, 123);
    expect(formatDateTimeMinute(date.toISOString())).toBe('2026-08-07 14:30');
  });

  it('zero-pads month, day, hour and minute', () => {
    const date = new Date(2026, 0, 5, 9, 5);
    expect(formatDateTimeMinute(date.toISOString())).toBe('2026-01-05 09:05');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatDateTimeMinute('')).toBe('');
    expect(formatDateTimeMinute('not-a-date')).toBe('not-a-date');
  });
});
