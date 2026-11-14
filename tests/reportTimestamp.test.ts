import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticReportDate} from '../src/utils/reportTimestamp';
test('reports use the Saudi submission day on both sides of midnight',()=>{
 assert.equal(automaticReportDate(new Date('2026-11-14T20:59:59Z')),'2026-11-14');
 assert.equal(automaticReportDate(new Date('2026-11-14T21:00:00Z')),'2026-11-15');
 assert.equal(automaticReportDate(new Date('2026-12-31T21:01:00Z')),'2027-01-01');
 assert.equal(automaticReportDate(new Date('invalid')),'');
 assert.equal(automaticReportDate('11/14/2026'),'');
});
