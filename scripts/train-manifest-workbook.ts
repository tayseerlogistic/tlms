/**
 * Offline training; no Firebase writes.
 * node --import tsx scripts/train-manifest-workbook.ts input.xlsx model.json 2026-11-04
 */
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import {extractTransitionObservations,trainTransitions,selectTransition,type HistoryRow,type ScheduleHistoryRow} from '../src/utils/routeProgression';
import {ksaDateISO,shiftISODate} from '../src/utils/dateUtils';
const [input,output,through=shiftISODate(ksaDateISO(),-1)]=process.argv.slice(2);
if(!input||!output)throw new Error('Supply input workbook and output model paths.');
const workbook=XLSX.read(fs.readFileSync(input),{type:'buffer',cellDates:false});
const norm=(value:unknown)=>String(value??'').toUpperCase().replace(/\s+/g,' ').trim();
const identity=(name:unknown,iqama:unknown)=>{
 const digits=String(typeof iqama==='number'?Math.trunc(iqama):iqama??'').replace(/\D/g,'');
 return digits.length>=9?'I:'+digits:'N:'+norm(name);
};
const excelDay=(value:unknown)=>{
 if(typeof value!=='number'||value<30000||value>90000)return null;
 const epoch=workbook.Workbook?.WBProps?.date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);
 return new Date(epoch+Math.floor(value)*86400000).toISOString().slice(0,10);
};
const records=new Map<string,HistoryRow&{name:string}>(),conflicts=new Set<string>();
let schedules:(ScheduleHistoryRow&{name:string})[]=[];
let manifestSheets=0,scheduleSheets=0;
for(const sheetName of workbook.SheetNames){
 const rows=XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName],{header:1,raw:true,defval:''});
 if(!/schedule/i.test(sheetName)){
  manifestSheets++;
  const index=rows.findIndex(row=>row.some(value=>norm(value).includes('IQAMA')));
  if(index<0)continue;
  const header=rows[index],iqama=header.findIndex(value=>norm(value).includes('IQAMA'));
  const dates=header.flatMap((value,column)=>{const date=excelDay(value);return date&&date<=through?[{column,date}]:[];});
  for(const row of rows.slice(index+1)){
   if(!row[1]||!String(row[0]??'').trim()||!Number.isFinite(Number(row[0]))||Number(row[0])<=0)continue;
   const driver=identity(row[1],row[iqama]);
   for(const {column,date}of dates){
    const tag=typeof row[column]==='string'?String(row[column]).trim():'';
    if(!tag)continue;
    const key=driver+'|'+date;
    if(conflicts.has(key))continue;
    if(records.has(key)&&records.get(key)!.tag!==tag){conflicts.add(key);records.delete(key);continue;}
    records.set(key,{driver,name:norm(row[1]),date,tag});
   }
  }
 }else{
  scheduleSheets++;let date='',columns=new Map<string,number>();
  for(const row of rows){
   const day=excelDay(row[0]);if(day){date=day;continue;}
   if(row.some(value=>norm(value)==='DRIVER NAME')){columns=new Map(row.map((value,index)=>[norm(value),index]));continue;}
   if(!date||date>through||!columns.size)continue;
   const get=(key:string)=>row[columns.get(key)??-1]??'';
   const name=String(get('DRIVER NAME')),commodity=String(get('COMMODITY')),destination=String(get('DESTINATION'));
   if(!name||!commodity||!destination)continue;
   schedules.push({driver:identity(name,get('IQAMA #')),name:norm(name),date,source:String(get('SOURCE')),destination,
    customer:String(get('CUSTOMER')),supplier:String(get('SUPPLIER')),store:String(get('STORE')),commodity,waybill:String(get('WAYBILL#'))});
  }
 }
}
const names=new Map<string,Set<string>>();
records.forEach(row=>{const ids=names.get(row.name)||new Set();ids.add(row.driver);names.set(row.name,ids);});
schedules=schedules.map(row=>row.driver.startsWith('N:')&&names.get(row.name)?.size===1?{...row,driver:[...names.get(row.name)!][0]}:row);
schedules=[...new Map(schedules.map(row=>[JSON.stringify(row),row])).values()];
const extracted=extractTransitionObservations([...records.values()],schedules);
const training=extracted.observations.filter(row=>row.date<'2026-10-01');
const holdout=extracted.observations.filter(row=>row.date>='2026-10-01');
const validationModel=trainTransitions(training);
let covered=0,correct=0,unchanged=0;
holdout.forEach(row=>{
 const prediction=selectTransition(validationModel,row.route,row.stage,row.age);
 if(!prediction)return;covered++;if(prediction.next===row.next)correct++;if(row.stage===row.next)unchanged++;
});
const model=trainTransitions(extracted.observations);
fs.writeFileSync(output,JSON.stringify(model));
const keys=new Set([...records.values()].map(row=>row.driver+'|'+row.date));
const groups=new Set(schedules.map(row=>row.driver+'|'+row.date));
const audit={
 sourceSheets:workbook.SheetNames.length,manifestSheets,scheduleSheets,through,
 statuses:records.size,scheduleRows:schedules.length,conflictingCells:conflicts.size,
 scheduleDriverDates:groups.size,sameDayDriverDateMatches:[...groups].filter(key=>keys.has(key)).length,
 matchedActivities:extracted.matched,ambiguousActivities:extracted.ambiguous,
 transitions:extracted.observations.length,trainingTransitions:training.length,holdoutTransitions:holdout.length,
 holdoutStart:'2026-10-01',coveredTransitions:covered,correctTransitions:correct,
 unchangedStageCorrect:unchanged,nextStageAccuracy:covered?correct/covered:0,
 unchangedStageAccuracy:covered?unchanged/covered:0,
 note:'Chronological next-stage validation on covered cross-matched transitions; not full-manifest or live-production accuracy. Final model is then refit on all eligible prior records.'
};
fs.writeFileSync(output.replace(/\.json$/,'.audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(audit);
