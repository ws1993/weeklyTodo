import { describe, expect, it } from 'vitest';
import { formatWeekRange, isCurrentWeek } from './weekFormat';

describe('formatWeekRange', () => {
  it('formats a week id as MM/DD - MM/DD', () => {
    expect(formatWeekRange('20260803-20260809')).toBe('08/03 - 08/09');
  });

  it('returns the input when it is malformed', () => {
    expect(formatWeekRange('nonsense')).toBe('nonsense');
  });
});

describe('isCurrentWeek', () => {
  it('detects the current local week', () => {
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndex);
    const key = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
        date.getDate(),
      ).padStart(2, '0')}`;
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const currentId = `${key(monday)}-${key(sunday)}`;
    expect(isCurrentWeek(currentId)).toBe(true);
    expect(isCurrentWeek('19990101-19990107')).toBe(false);
  });
});
