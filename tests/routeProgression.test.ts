import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../src/data/manifestTransitions.json';
import {trainTransitions,predictRouteProgression,routeFor,extractTransitionObservations,liveTransitionModel,type TransitionModel} from '../src/utils/routeProgression';
import {manifestActivity} from '../src/utils/dispatchManifest';
import {predictManifestForDriver} from '../src/utils/manifestAiEngine';
import type {Driver,TimetableRow,DailySchedule} from '../src/types';
const row=(patch:Partial<TimetableRow>={})=>({id:'trip',driverId:'d',driverName:'Driver',source:'Yanbu',destination:'Turaif',customer:'Plant',supplier:'',store:'',commodity:'FC',waybill:'100',...patch}) as TimetableRow;
const schedules=(r:TimetableRow)=>({'2026-11-01':{date:'2026-11-01',rows:[r]}} as Record<string,DailySchedule>);
const driver=(history:Record<string,string>)=>({id:'d',name:'Driver',history}) as Driver;
const model=reference as TransitionModel;

test('observed Turaif route advances loading to travel to offloading rather than repeating loading',()=>{
 const first='FC Supply for Plant - Under Loading at Yanbu';
 const next=predictRouteProgression(driver({'2026-11-01':first}),'2026-11-02',first,[],schedules(row()),model)!;
 assert.equal(next.text,'FC Supply for Plant - On the way to Turaif');
 const offload=predictRouteProgression(driver({'2026-11-01':first,'2026-11-02':next.text}),'2026-11-03',next.text,[],schedules(row()),model)!;
 assert.equal(offload.text,'FC Supply for Plant - Under Offloading at Turaif');
});
test('warehouse journeys retain Transfer and customer shipments retain Supply',()=>{
 const warehouse=row({destination:'Dammam',customer:'',store:'Dammam Warehouse'});
 const first=manifestActivity(warehouse);
 assert.equal(first,'FC Transfer Dammam WH - Under Loading at Yanbu');
 const suggestion=predictRouteProgression(driver({'2026-11-01':first}),'2026-11-02',first,[],schedules(warehouse),model)!;
 assert.equal(suggestion.text,'FC Transfer Dammam WH - On the way to Dammam');
 assert.match(manifestActivity(row({customer:'External Warehouse Company',store:'Warehouse'})),/Supply for External Warehouse Company/);
 assert.equal(manifestActivity(row({source:'TPF',destination:'TLS',customer:'',store:'TLS Warehouse'})),'Internal Transfer');
});
test('a newly issued waybill starts a new dispatch while a repeated waybill can progress',()=>{
 const first='FC Supply for Plant - Under Loading at Yanbu',d=driver({'2026-11-01':first});
 assert.match(predictRouteProgression(d,'2026-11-02',first,[row({waybill:'200'})],schedules(row()),model)!.text,/Under Loading/);
 assert.match(predictRouteProgression(d,'2026-11-02',first,[row()],schedules(row()),model)!.text,/On the way/);
});
test('learning uses days spent in a stage instead of a universal one-day rule',()=>{
 const r=row(),route=routeFor(r);
 const observations=[1,2,3].flatMap(()=>[{date:'2026-01-02',route,stage:'loading' as const,age:1,next:'loading' as const},{date:'2026-01-03',route,stage:'loading' as const,age:2,next:'transit' as const}]);
 const trained=trainTransitions(observations),first='FC Supply for Plant - Under Loading at Yanbu';
 assert.match(predictRouteProgression(driver({'2026-11-01':first}),'2026-11-02',first,[],schedules(r),trained)!.text,/Under Loading/);
 assert.match(predictRouteProgression(driver({'2026-11-01':first,'2026-11-02':first}),'2026-11-03',first,[],schedules(r),trained)!.text,/On the way/);
});
test('multiple current trips stay present and confirmed manual tags are never overwritten',()=>{
 const first='FC Supply for Plant - Under Loading at Yanbu',d=driver({'2026-11-01':first});
 const suggestion=predictRouteProgression(d,'2026-11-02',first,[row(),row({id:'internal',source:'TLS',destination:'TPF'})],schedules(row()),model)!;
 assert.equal(suggestion.text,'FC Supply for Plant - On the way to Turaif / Internal Transfer');
 assert.equal(predictManifestForDriver(0,d,'2026-11-02',[],first,[],'Confirmed manual status',{schedules:schedules(row()),model}).text,'Confirmed manual status');
});
test('missing calendar days and ambiguous routes do not invent progress',()=>{
 const tag='FC Supply for Plant - Under Loading at Yanbu';
 assert.equal(predictRouteProgression(driver({'2026-11-01':tag}),'2026-11-04',tag,[],schedules(row()),model),null);
 const s={'2026-11-01':{date:'2026-11-01',rows:[row(),row({destination:'Jeddah'})]}};
 assert.equal(predictRouteProgression(driver({'2026-11-01':tag}),'2026-11-02',tag,[],s,model)!.conf,'low');
});
test('training deduplicated canonical input counts each transition once and respects chronological cutoff',()=>{
 const records=[{driver:'d',date:'2026-11-01',tag:'FC Supply for Plant - Under Loading at Yanbu'},{driver:'d',date:'2026-11-02',tag:'FC Supply for Plant - On the way to Turaif'}];
 const extracted=extractTransitionObservations(records,[{...row(),driver:'d',date:'2026-11-01'}]);
 assert.equal(extracted.observations.length,1);
 const historical=liveTransitionModel(model,[driver(Object.fromEntries(records.map(r=>[r.date,r.tag])))],schedules(row()),{},'2026-11-02');
 assert.equal(historical.observations,0); // Later target status is excluded; future reference model is excluded too.
});
test('changed destinations start a new draft and full commodity names match their short codes',()=>{
 const first='FC Supply for Plant - Under Loading at Yanbu',d=driver({'2026-11-01':first});
 const changed=predictRouteProgression(d,'2026-11-02',first,[row({destination:'Jeddah',waybill:''})],schedules(row()),model)!;
 assert.match(changed.text,/Under Loading/);
 const repeat=predictRouteProgression(d,'2026-11-02',first,[row({commodity:'Ferric Chloride'})],schedules(row()),model)!;
 assert.match(repeat.text,/On the way/);
});
test('an explicit travel destination can advance without a dispatch; stale loading needs an entry',()=>{
 const tag='FC Supply for Plant - On the way to Turaif';
 const predict=(date:string,previous:string)=>predictManifestForDriver(0,driver({'2026-11-01':previous}),date,[],previous,[],undefined,{schedules:{},model});
 assert.match(predict('2026-11-02',tag).text,/Under Offloading at Turaif/);
 assert.equal(predict('2026-11-03','FC Supply for Plant - Under Loading at Yanbu').text,'');
});

test('yesterday’s loading suggests travel for unmatched supply trips without guessing a city', () => {
 for (const shipment of ['SA Supply for MWSPC', 'AS Supply for AL MARAI', 'CS Supply for PRC']) {
  const tag = shipment + ' - Under Loading at Yanbu';
  const suggestion = predictManifestForDriver(0, driver({'2026-11-10':tag}), '2026-11-11',
   [], tag, [], undefined, {schedules:{}, model});
  assert.equal(suggestion.text, shipment + ' - On the way');
  assert.equal(suggestion.conf, 'low');
 }
});

test('a unique dispatch yesterday supplies the destination even with no learned transitions', () => {
 const tag = 'FC Supply for Plant - Under Loading at Yanbu';
 const result = predictRouteProgression(driver({'2026-11-01':tag}), '2026-11-02', tag,
  [], schedules(row()), trainTransitions([]));
 assert.equal(result?.text, 'FC Supply for Plant - On the way to Turaif');
});
