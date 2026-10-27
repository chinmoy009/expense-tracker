/** Local calendar date as YYYY-MM-DD (unlike toISOString, which is UTC). */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today's local calendar date as YYYY-MM-DD. */
export function todayLocalISODate(): string {
  return toLocalISODate(new Date());
}

/** Parses YYYY-MM-DD (or an ISO timestamp) as a local-midnight Date. */
export function parseLocalISODate(iso: string): Date {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}
