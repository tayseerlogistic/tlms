import assert from 'node:assert/strict';
import test from 'node:test';
import { orderScheduleTrips } from '../src/utils/scheduleOrder';
import type { TimetableRow } from '../src/types';

test('waybills sort numerically across fleets and unnumbered trips retain their sequence', () => {
  const row = (id: string, waybill: string, transporter = 'TLS') =>
    ({ id, waybill, transporter, commodity: '', plateNo: '', customer: '', source: '', destination: '' } as TimetableRow);
  const rows = [row('a',''),row('b','100'),row('c',' '),row('d','9','External'),row('e','100')];
  for (const fleetOrder of [true,false]) {
    assert.deepEqual(orderScheduleTrips(rows,fleetOrder).map(r=>r.id), ['d','b','e','a','c']);
  }
  rows[2].waybill = '99';
  assert.deepEqual(orderScheduleTrips(rows,false).map(r=>r.id), ['d','c','b','e','a']);
  rows[2].waybill = '';
  assert.deepEqual(orderScheduleTrips(rows,false).map(r=>r.id), ['d','b','e','a','c']);
});
