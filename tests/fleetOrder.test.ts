import test from 'node:test';
import assert from 'node:assert/strict';
import {FLEET_PLATE_SEQUENCE,fleetSequence,sortFleetTrucks,missingFleetPlates} from '../src/utils/fleetOrder';
import {parseDailyMeters,dailyMeterExport} from '../src/utils/dailyMeterImport';
import type {Truck} from '../src/types';

test('approved 47-truck sequence places SSA1197 at 35 without changing identities',()=>{
 assert.equal(FLEET_PLATE_SEQUENCE.length,47);
 assert.equal(new Set(FLEET_PLATE_SEQUENCE).size,47);
 assert.equal(fleetSequence('SSA1197'),35);assert.equal(fleetSequence('أ س س S S A 1198'),36);
 assert.equal(fleetSequence('HXA3598'),47);
 const input=FLEET_PLATE_SEQUENCE.map((plate,index)=>({id:'stable-'+index,plate,seq:999})).reverse();
 const before=JSON.stringify(input),ordered=sortFleetTrucks(input);
 assert.deepEqual(ordered.map(truck=>truck.plate),[...FLEET_PLATE_SEQUENCE]);
 assert.equal(JSON.stringify(input),before);assert.equal(ordered[34].id,'stable-34');
});
test('future trucks remain available after the approved list; missing trucks are reported',()=>{
 const rows=[{id:'extra',plate:'ABC9999'},{id:'last',plate:'HXA3598'}];
 assert.equal(sortFleetTrucks(rows)[1].id,'extra');
 assert.ok(missingFleetPlates(rows).includes('S S A 1197'));
});
test('47-value imports and exports use the same fleet order regardless of input array order',()=>{
 const trucks=FLEET_PLATE_SEQUENCE.map((plate,index)=>({id:'t'+index,plate})).reverse() as Truck[];
 const values=Array.from({length:47},(_,index)=>[100000+index]);
 const imported=parseDailyMeters(values,trucks,'2026-11-01',true);
 assert.equal(imported[34].plate,'S S A 1197');assert.equal(imported[34].odometer,100034);
 assert.throws(()=>parseDailyMeters(values.slice(0,46),trucks,'2026-11-01',true),/exactly 47/);
 const output=dailyMeterExport(trucks,[],'2026-11-01');
 assert.equal(output[34]['Truck Plate#'],'S S A 1197');assert.equal(output[34]['SL#'],35);
 assert.equal(output[46]['Truck Plate#'],'H X A 3598');
});
