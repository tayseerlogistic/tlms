/** Shared date helpers. Business dates are interpreted in Saudi Arabia (Asia/Riyadh). */
export function ksaDateISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Move a YYYY-MM-DD business date by whole days without local/UTC rollover. */
export function shiftISODate(isoDate: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match || !Number.isFinite(deltaDays)) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Math.trunc(deltaDays)));
  return date.toISOString().slice(0, 10);
}

/** First day of the month containing an ISO date, shifted by deltaMonths. */
export function shiftISOMonth(isoDate: string, deltaMonths = 0): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match || !Number.isFinite(deltaMonths)) return isoDate.slice(0, 7);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + Math.trunc(deltaMonths), 1));
  return date.toISOString().slice(0, 7);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
