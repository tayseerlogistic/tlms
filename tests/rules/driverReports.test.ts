import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,type Firestore} from 'firebase/firestore';

test('Google bridge and TLMS approval share reports, meter validation, history and idempotent delivery',async t=>{
 const project='demo-driver-reports';
 const env=await initializeTestEnvironment({projectId:project,firestore:{rules:readFileSync('firestore.rules','utf8')}});
 t.after(()=>env.cleanup());
 await env.withSecurityRulesDisabled(async ctx=>{
  await setDoc(doc(ctx.firestore(),'drivers','d'),{name:'Driver',active:true,assignedTruckId:'t'});
  await setDoc(doc(ctx.firestore(),'trucks','t'),{plate:'D J A 4827',assignedDriverId:'d',assignedDriverName:'Driver'});
 });
 const root='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)/documents';
 const sandbox:any={Date,console,ScriptApp:{getOAuthToken:()=>''},Utilities:{formatDate:(date:Date)=>date.toISOString().slice(0,10)},UrlFetchApp:{
  fetch:(url:string,options:any)=>{
   const path=url.split('/documents')[1];
   const raw=execFileSync('curl',['--noproxy','*','-sS','-X','POST','-H','Authorization: Bearer owner','-H','Content-Type: application/json','-d',options.payload,root+path],{encoding:'utf8'});
   const data=JSON.parse(raw);
   return {getContentText:()=>raw,getResponseCode:()=>data.error?.code||200};
  }
 }};
 vm.createContext(sandbox);
 vm.runInContext(readFileSync('dist-driver-report/Code.gs','utf8').replaceAll('PASTE_FIREBASE_PROJECT_ID',project).replaceAll('PASTE_RESPONSE_SPREADSHEET_ID','test-sheet'),sandbox);
 const accept=sandbox.TLMSBridge.integrationTest.acceptRow;
 const cols={timestamp:0,plate:1,meter:2,date:3,status:4,remarks:5};
 const row=(date:string,meter:number,status='🚛 On the Way / راستے میں / रास्ते में')=>[new Date(), 'D J A 4827',meter,date,status,''];
 assert.match(accept(row('2026-11-10',1000),2,cols),/accepted/);
 assert.match(accept(row('2026-11-11',1200),3,cols),/accepted/);
 assert.match(accept(row('2026-11-11',1200),3,cols),/Already delivered/);
 assert.match(accept(row('2026-11-11',1200),4,cols),/duplicate/);
 assert.match(accept(row('2026-11-11',1250),5,cols),/review/);
 const db=env.authenticatedContext('admin',{email:'admin@tls.com'}).firestore();
 const {createFleetRepository}=await import('../../src/services/fleetRepository');
 const repo=createFleetRepository((db as unknown as {_delegate:Firestore})._delegate,()=> 'admin');
 assert.equal((await getDoc(doc(db,'km_records','t_2026-11-11'))).data()?.distanceKm,200);
 const reportId='sheet_test-sheet_5';
 await repo.reviewDriverReport(reportId,true);
 assert.equal((await getDoc(doc(db,'km_records','t_2026-11-11'))).data()?.distanceKm,250);
 assert.equal((await getDoc(doc(db,'driver_report_days','t_2026-11-11'))).data()?.reportId,reportId);
 await assert.rejects(repo.reviewDriverReport(reportId,true),/already been reviewed/);
 // An unrecognized plate is retained for review rather than lost after a trigger retry.
 const bad=row('2026-11-11',99);bad[1]='UNKNOWN';
 assert.match(accept(bad,6,cols),/Review/);
 const missing=await getDoc(doc(db,'driver_reports','sheet_test-sheet_6'));
 assert.equal(missing.data()?.state,'review');
 assert.ok(missing.data()?.validationError);
 await assert.rejects(repo.reviewDriverReport(missing.id,true),/Correct the form/);
 const cacheRows: string[][]=[];
 const cacheSheet={
  hideSheet:()=>{},getLastRow:()=>cacheRows.length,getMaxRows:()=>1000,clearContents:()=>{cacheRows.length=0;},
  getRange:(start:number,_column:number,count:number)=>({
    getValues:()=>cacheRows.slice(start-1,start-1+count),
    setValues:(values:string[][])=>{values.forEach((row,index)=>cacheRows[start-1+index]=row);}
  })
 };
 const spreadsheet={getSheetByName:()=>cacheSheet};
 const mirror=sandbox.TLMSBridge.integrationTest.mirrorData;
 assert.equal(mirror(spreadsheet).driver_report_days.length,2);
 const cached=mirror(spreadsheet);
 assert.equal(cached.driver_reports.find((row:any)=>row.id===reportId).state,'accepted');
 const driver=env.authenticatedContext('d').firestore();
 await assertFails(setDoc(doc(driver,'driver_report_days','t_2026-11-11'),{state:'accepted'}));
 await repo.assignTruck('t',null,'2026-11-12');
 assert.equal((await getDoc(doc(db,'trucks','t'))).data()?.assignedDriverId,null);
 assert.equal((await getDoc(doc(db,'drivers','d'))).data()?.assignedTruckId,null);
});
