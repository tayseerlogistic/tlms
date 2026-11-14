import test from 'node:test';
import assert from 'node:assert/strict';
import {reportMeterPlan, reportManifest, reportStatus, resolveReportAssignment, validateDriverReport, type DriverReport, type ReportDay} from '../src/utils/driverReports';
import {sortManifestDrivers} from '../src/utils/driverSequence';
import {predictManifestForDriver} from '../src/utils/manifestAiEngine';
import type {Driver,Truck,KmRecord,TimetableRow} from '../src/types';
const driver={id:'d',name:'Driver'} as Driver;
const report={id:'r',driverId:'d',driverName:'Driver',truckId:'t',plate:'DJA 4827',date:'2026-11-14',odometer:1200,status:'transit',remarks:'',source:'google-form',submittedAt:'2026-11-14T18:00:00Z',state:'accepted',reason:''} as DriverReport;
const meter=(date:string,odometer:number,source='google-form')=>({id:'t_'+date,truckId:'t',date,odometerKm:odometer,source,km:0,distanceKm:0,veh:report.plate}) as KmRecord;
test('form labels map to nine precise stages, especially waiting versus offloading',()=>{
 assert.equal(reportStatus('⏳ Waiting for Offloading / انتظار / इंतज़ार'),'waiting');
 assert.equal(reportStatus('📦 Offloading / ان لوڈنگ / अनलोडिंग'),'offloading');
 assert.equal(reportStatus('🔧 Maintenance / Breakdown / خرابی / खराबी'),'maintenance');
 assert.equal(reportStatus('Offloading Completed'),undefined);
 assert.throws(()=>validateDriverReport({...report,date:'2026-11-31'},'2026-11-30'));
});
test('reports calculate only adjacent-day distances and repair the following derived day',()=>{
 const plan=reportMeterPlan(report,[meter('2026-11-13',1000),meter('2026-11-15',1600)]);
 assert.equal(plan.writes[0].distanceKm,200);
 assert.equal(plan.writes[1].distanceKm,400);
 assert.equal(reportMeterPlan(report,[meter('2026-11-12',1000)]).writes[0].distanceKm,0);
 assert.match(reportMeterPlan(report,[meter('2026-11-12',1000)]).reason,/Missing/);
 assert.equal(reportMeterPlan({...report,odometer:900},[meter('2026-11-13',1000)]).state,'review');
 assert.equal(reportMeterPlan({...report,odometer:5000},[meter('2026-11-13',1000)]).state,'review');
 assert.throws(()=>reportMeterPlan({...report,odometer:5000},[meter('2026-11-13',1000)],undefined,true),/Correct/);
});
test('changed meters and statuses need review and manual distance is retained',()=>{
 const prior={...report,reportId:'old',odometer:1100} as ReportDay;
 assert.equal(reportMeterPlan(report,[],prior).state,'review');
 assert.equal(reportMeterPlan({...report,status:'offloading'},[],{...report,reportId:'old'}).state,'review');
 const manual={...meter(report.date,1200,'import'),distanceKm:77,km:77};
 assert.equal(reportMeterPlan(report,[manual]).writes[0].distanceKm,77);
});
test('manifest combines dispatch details with reported stage, protects confirmations and flags multiple routes',()=>{
 const trip={id:'trip',driverId:'d',truckId:'t',plateNo:report.plate,driverName:'Driver',source:'Yanbu',destination:'Rabigh',customer:'Example Customer',commodity:'CS',supplier:'',store:'',waybill:'53282'} as TimetableRow;
 const schedules={[report.date]:{date:report.date,rows:[trip]}};
 assert.equal(reportManifest(report,driver,schedules,'').text,'CS Supply for Example Customer - On the way to Rabigh');
 assert.match(reportManifest({...report,status:'waiting'},driver,schedules,'').text,/Waiting for Offloading/);
 assert.equal(reportManifest(report,driver,{[report.date]:{date:report.date,rows:[trip,{...trip,id:'2',destination:'Jeddah'}]}},'').text,'');
 assert.equal(predictManifestForDriver(0,driver,report.date,[],'',[],'Confirmed',{schedules,reports:[{...report,reportId:'r'}]}).text,'Confirmed');
});
test('assignment changes preserve historical binding and new names append to approved sequence',()=>{
 const truck={id:'t',assignedDriverId:'new',assignedDriverName:'New'} as Truck;
 const events=[{id:'event',truckId:'t',plate:'DJA4827',driverId:'new',driverName:'New',previousDriverId:'old',previousDriverName:'Old',effectiveDate:'2026-11-14',changedAt:'2026-11-14T06:00:00Z'}];
 assert.equal(resolveReportAssignment(truck,'2026-11-13',events,[]).driverId,'old');
 assert.equal(resolveReportAssignment(truck,'2026-11-14',events,[]).driverId,'new');
 const rows=[{id:'new',name:'New',seq:1},{id:'last',name:'Last Driver',seq:0},{id:'first',name:'First Driver',seq:99}] as Driver[];
 assert.deepEqual(sortManifestDrivers(rows,['First Driver','Last Driver']).map(row=>row.id),['first','last','new']);
});
