/**
 * Format an ISO timestamp to minute precision in the local timezone,
 * e.g. `2026-08-07T14:30:00.123` -> `2026-08-07 14:30`.
 * Returns the input unchanged when it cannot be parsed.
 */
export function formatDateTimeMinute(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Format an ISO timestamp to day precision in the local timezone,
 * e.g. `2026-08-07T14:30:00.123` -> `2026-08-07`.
 * Returns the input unchanged when it cannot be parsed.
 */
export function formatDateDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
