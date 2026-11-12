import type { TimetableRow } from '../types';
import { compareFleetPlates } from './fleetOrder';
import { schedulePriority } from './timetableEngine';

const byNumber = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
export const waybillText = (row: TimetableRow) => String(row.waybill ?? '').trim();

export function orderScheduleTrips(rows: TimetableRow[], fleetOrder: boolean) {
  return [...rows].sort((a, b) => {
    const first = waybillText(a), second = waybillText(b);
    if (first && second) return byNumber.compare(first, second);
    if (first || second) return first ? -1 : 1;
    if (fleetOrder) return schedulePriority(a) - schedulePriority(b) || compareFleetPlates(a.plateNo, b.plateNo);
    const external = (row: TimetableRow) => Boolean(row.transporter && row.transporter !== 'TLS');
    return Number(external(a)) - Number(external(b));
  });
}
