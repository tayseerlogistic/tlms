import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseManifestWorkbook} from '../src/utils/manifestWorkbook';
import {parseMultiDayManifest} from '../src/utils/multiDayManifestParser';
import type {Driver} from '../src/types';
const drivers=[{id:'d1',name:'DRIVER A',iqama:'1234567890',empNo:'E1'}] as Driver[];
function workbook(sheets: Record<string, unknown[][]>) {
  const book=XLSX.utils.book_new();
  for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),name);
  return book;
}
test('workbook dates use Excel calendar days; schedule tabs and future statuses are excluded',()=>{
  const book=workbook({
    October:[['SL#','Name','Iqama #',46326,46327],[1,'DRIVER A','1234567890','Loading','Travel']],
    'Daily Schedule':[['Name','Iqama #',46326],['DRIVER A','1234567890','Wrong']],
  });
  const result=parseManifestWorkbook(book,drivers,'2026-10-31');
  assert.deepEqual(result.detectedDates,['2026-10-31']);
  assert.equal(result.totalEntriesCount,1);
  assert.equal(result.manifestByDate['2026-10-31'].d1,'Loading');
});
test('overlapping contradictory cells are omitted instead of overwriting history',()=>{
  const book=workbook({
    A:[['Driver Name','Iqama #',46326],['DRIVER A','1234567890','Loading']],
    B:[['Driver Name','Iqama #',46326],['DRIVER A','1234567890','Vacation']],
    C:[['Driver Name','Iqama #',46325],['DRIVER A','1234567890','At Yanbu']],
  });
  const result=parseManifestWorkbook(book,drivers,'2026-11-01');
  assert.equal(result.manifestByDate['2026-10-31'],undefined);
  assert.equal(result.unmatchedLines.length,1);
});
test('unknown historical identity cannot inherit the current driver of a reused plate',()=>{
  const result=parseMultiDayManifest('Driver Name\tIqama #\tVehicle Plate No\tThursday, 1\nOLD DRIVER\t9999999999\tABC 1234\tVacation',
    [{...drivers[0],assignedVehiclePlate:'ABC 1234'}],'2026-10');
  assert.equal(result.mappedDriversCount,0);
});
