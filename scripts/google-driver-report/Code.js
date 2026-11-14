import { sortManifestDrivers } from '../../src/utils/driverSequence';
import { REPORT_STATUSES, reportStatus, resolveReportAssignment, validateDriverReport, reportMeterPlan } from '../../src/utils/driverReports';
import { predictSheetManifest } from '../../src/utils/sheetManifest';

const CONFIG = {sheetId:'PASTE_RESPONSE_SPREADSHEET_ID',project:'PASTE_FIREBASE_PROJECT_ID',zone:'Asia/Riyadh',truckOrder:[],driverOrder:[]};
function sortFleetTrucks(trucks) {
 const key=value=>String(value||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
 const rank=value=>{const i=CONFIG.truckOrder.findIndex(plate=>key(plate)===key(value));return i<0?9999:i;};
 return [...trucks].sort((a,b)=>rank(a.plate)-rank(b.plate)||(a.createdAt||'').localeCompare(b.createdAt||'')||(a.seq||0)-(b.seq||0)||a.id.localeCompare(b.id));
}
const root = 'projects/'+CONFIG.project+'/databases/(default)/documents';
const props = () => PropertiesService.getScriptProperties();
const now = () => new Date().toISOString();
function api(path, body, method = 'post') {
 const response = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/'+root+path,{
  method,contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
  ...(body?{payload:JSON.stringify(body)}:{}),muteHttpExceptions:true
 });
 const data=JSON.parse(response.getContentText());
 if(response.getResponseCode()>=300)throw Error(data.error?.message||'Firestore request failed');
 return data;
}
function encode(value) {
 if(value===null || value===undefined)return {nullValue:null};
 if(typeof value==='string')return {stringValue:value};
 if(typeof value==='number')return {doubleValue:value};
 if(typeof value==='boolean')return {booleanValue:value};
 if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
 return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]))}};
}
function decode(value) {
 if('stringValue' in value)return value.stringValue;
 if('integerValue' in value)return Number(value.integerValue);
 if('doubleValue' in value)return value.doubleValue;
 if('booleanValue' in value)return value.booleanValue;
 if('nullValue' in value)return null;
 if(value.arrayValue)return (value.arrayValue.values||[]).map(decode);
 if(value.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([key,item])=>[key,decode(item)]));
 return value.timestampValue || null;
}
function unpack(document) {return {...Object.fromEntries(Object.entries(document.fields||{}).map(([key,value])=>[key,decode(value)])),id:document.name.split('/').pop()};}
function list(name, field, value, transaction) {
 const structuredQuery={from:[{collectionId:name}]};
 if(field)structuredQuery.where={fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:encode(value)}};
 return api(':runQuery',{structuredQuery,...(transaction?{transaction}:{})}).filter(row=>row.document).map(row=>unpack(row.document));
}
function read(name, transaction) {
 const rows=api(':batchGet',{documents:[root+'/'+name],...(transaction?{transaction}:{})});
 const doc=rows.find(row=>row.found)?.found;
 return doc ? unpack(doc):null;
}
function write(name, value) {
 const fields=Object.fromEntries(Object.entries(value).filter(([key])=>key!=='id').map(([key,item])=>[key,encode(item)]));
 if(!name.startsWith('assignment_events/'))fields.updatedAt=encode(now());
 return {update:{name:root+'/'+name,fields},updateMask:{fieldPaths:Object.keys(fields)}};
}
function commit(writes, transaction) {api(':commit',{writes,...(transaction?{transaction}:{})});}
function recordHealth(error='') {
 commit([write('integration_status/google-form',{lastAttempt:now(),...(error?{error}:{lastSuccess:now(),error:''}),version:2})]);
}
function responseSheet(ss) {
 const title=props().getProperty('responseTab');
 const sheet=ss.getSheetByName(title);
 if(!sheet)throw Error('Response tab missing. Run setupTLMS again.');
 return sheet;
}
function headers(sheet) {
 const names=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0].map(text=>text.trim().toLowerCase());
 const find=(name,test)=>{const i=names.findIndex(test);if(i<0)throw Error('Required response column missing: '+name);return i;};
 return {
  timestamp:find('Timestamp',v=>v==='timestamp'),
  plate:find('Truck Plate Number',v=>v.includes('truck')&&(v.includes('plate')||v.includes('number')) || v==='question'),
  meter:find('Current Odometer KM',v=>v.includes('odometer')),
  date:find('Report Date',v=>v==='report date'),
  status:find('Current Truck Status',v=>v==='current truck status'),
  remarks:names.indexOf('remarks')
 };
}
function day(value) {return value instanceof Date && !isNaN(value) ? Utilities.formatDate(value,CONFIG.zone,'yyyy-MM-dd') : /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value):'';}
function number(value) {
 const text=String(value).trim();
 return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)?Number(text.replace(/,/g,'')):NaN;
}
export function setupTLMS() {
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try {
  if(CONFIG.sheetId.startsWith('PASTE_') || CONFIG.project.startsWith('PASTE_'))throw Error('Set the spreadsheet ID and Firebase project ID in CONFIG before running setupTLMS.');
  const ss=SpreadsheetApp.openById(CONFIG.sheetId);
  const trucks=list('trucks');
  if(!trucks.length)throw Error('No trucks available. Check Google Cloud access to '+CONFIG.project);
  if(!CONFIG.truckOrder.length || !CONFIG.driverOrder.length)throw Error('Set the approved truckOrder and driverOrder in CONFIG. Use the privately supplied setup package.');
  commit([write('app_state/report_sequences',{driverOrder:CONFIG.driverOrder,truckOrder:CONFIG.truckOrder})]);
  // Establish write access before updating the form.
  commit([write('integration_status/google-form',{lastAttempt:now(),setupState:'configuring',error:''})]);
  const url=ss.getFormUrl();if(!url)throw Error('Link the Tayseer Driver Report form to this spreadsheet first.');
  const form=FormApp.openByUrl(url),items=form.getItems();
  const matches=items.filter(item=>item.getType()===FormApp.ItemType.LIST && /truck|plate|^question$/i.test(item.getTitle()));
  if(matches.length!==1)throw Error('The linked form needs exactly one truck dropdown. Rename it Truck Plate Number.');
  const plate=matches[0].asListItem();plate.setTitle('Truck Plate Number').setRequired(true);
  const live=sortFleetTrucks(trucks.filter(truck=>!truck.archived&&!truck.isThirdParty));
  plate.setChoiceValues(live.map(truck=>truck.plate));
  function question(title,type,add) {
   const found=form.getItems().filter(item=>item.getTitle().trim().toLowerCase()===title.toLowerCase());
   if(found.length>1)throw Error('Duplicate form field: '+title);
   if(found[0]&&found[0].getType()!==type)throw Error('Wrong question type: '+title);
   if(found[0])return found[0];
   return form.getItemById(add().getId());
  }
  question('Report Date',FormApp.ItemType.DATE,()=>form.addDateItem().setTitle('Report Date')).asDateItem().setIncludesYear(true).setRequired(true)
   .setHelpText('Choose the working day being reported, including when submitting after midnight.');
  let meter=form.getItems().find(item=>item.getType()===FormApp.ItemType.TEXT && /odometer/i.test(item.getTitle()));
  if(!meter)meter=form.getItemById(form.addTextItem().getId());
  meter.asTextItem().setTitle('Current Odometer KM').setRequired(true).setValidation(FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build());
  question('Current Truck Status',FormApp.ItemType.MULTIPLE_CHOICE,()=>form.addMultipleChoiceItem().setTitle('Current Truck Status'))
   .asMultipleChoiceItem().setRequired(true).setChoiceValues(REPORT_STATUSES.map(([,label])=>label));
  question('Remarks',FormApp.ItemType.PARAGRAPH_TEXT,()=>form.addParagraphTextItem().setTitle('Remarks')).asParagraphTextItem().setRequired(false);
  form.setTitle('Tayseer Driver Report');
  ss.setSpreadsheetTimeZone(CONFIG.zone);
  // Resolve the real response tab by its timestamp header, including existing responses.
  const candidates=ss.getSheets().filter(s=>s.getLastRow() && s.getRange(1,1).getDisplayValue().trim().toLowerCase()==='timestamp');
  if(candidates.length!==1)throw Error('Cannot identify the response tab. Keep one linked form response tab.');
  const response=candidates[0];props().setProperty('responseTab',response.getName());
  if(!props().getProperty('nextRow'))props().setProperty('nextRow',String(response.getLastRow()+1));
  for(const title of ['KM Readings','Daily Follow-up'])if(!ss.getSheetByName(title))ss.insertSheet(title);
  if(!ss.getSheetByName('TLMS Sync Log'))ss.insertSheet('TLMS Sync Log').appendRow(['Processed at','Response row','Report date','Plate','Result']);
  const triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(t=>t.getHandlerFunction()==='submitTLMS'))ScriptApp.newTrigger('submitTLMS').forSpreadsheet(ss).onFormSubmit().create();
  if(!triggers.some(t=>t.getHandlerFunction()==='syncTLMS'))ScriptApp.newTrigger('syncTLMS').timeBased().everyMinutes(5).create();
  props().setProperty('formId',form.getId());
  refreshViews(ss);recordHealth();
 }finally{lock.releaseLock();}
}
export function submitTLMS(e) {
 if(e?.range && e.range.getSheet().getName()===props().getProperty('responseTab'))syncTLMS();
}
function acceptRow(row,index,cols) {
 const date=day(row[cols.date]),plate=String(row[cols.plate]||'').trim();
 const id='sheet_'+CONFIG.sheetId+'_'+index;
 const transaction=api(':beginTransaction',{}).transaction;
 let committed=false;
 try {
  if(read('driver_reports/'+id,transaction))return 'Already delivered';
  const trucks=list('trucks',null,null,transaction);
  const match=trucks.filter(truck=>truck.plate.replace(/[^A-Z0-9]/gi,'').toUpperCase()===plate.replace(/[^A-Z0-9]/gi,'').toUpperCase());
  const truck=match.length===1?match[0]:{id:'',plate};
  const drivers=list('drivers',null,null,transaction),events=list('assignment_events','truckId',truck.id,transaction);
  const report={
   id,date,plate:truck.plate,truckId:truck.id,...resolveReportAssignment(truck,date,events,drivers),
   submittedAt:row[cols.timestamp] instanceof Date?row[cols.timestamp].toISOString():now(),
   odometer:number(row[cols.meter]),status:reportStatus(String(row[cols.status])),remarks:cols.remarks>=0?String(row[cols.remarks]||''):'',
   state:'accepted',reason:'',source:'google-form',sourceRow:index
  };
  let invalid = match.length!==1?'Unknown or ambiguous truck':'';
  try {validateDriverReport(report,day(new Date()));}catch(error){invalid=invalid||error.message;}
  if(invalid) {
   const raw={...report,odometer:Number.isFinite(report.odometer)?report.odometer:0,status:report.status||'loading',
    validationError:invalid,rawOdometer:String(row[cols.meter]),rawStatus:String(row[cols.status]),rawDate:String(row[cols.date]),state:'review',reason:invalid};
   commit([write('driver_reports/'+id,raw)],transaction);committed=true;return 'Review · '+invalid;
  }
  const key=truck.id+'_'+date,previous=read('driver_report_days/'+key,transaction);
  const records=list('km_records','truckId',truck.id,transaction);
  const plan=reportMeterPlan(report,records,previous);
  const identical=previous&&previous.odometer===report.odometer&&previous.status===report.status&&previous.remarks===report.remarks;
  report.state=identical?'duplicate':plan.state;report.reason=identical?'Identical submission retained':plan.reason;
  const writes=[write('driver_reports/'+id,report)];
  if(report.state==='accepted'){
   writes.push(write('driver_report_days/'+key,{...report,reportId:id}));
   writes.push(...plan.writes.map(record=>write('km_records/'+record.id,record)));
  }
  writes.push(write('trucks/'+truck.id,{reportRevision:Number(truck.reportRevision||0)+1}));
  commit(writes,transaction);committed=true;return report.state+' · '+report.reason;
 }finally{if(!committed){try{api(':rollback',{transaction});}catch(error){console.warn('Transaction already closed');}}}
}
export function syncTLMS() {
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try {
  const ss=SpreadsheetApp.openById(CONFIG.sheetId),sheet=responseSheet(ss);
  let next=Number(props().getProperty('nextRow'));
  if(!next)throw Error('Run setupTLMS first.');
  if(sheet.getLastRow()>=next) {
   const cols=headers(sheet),end=Math.min(sheet.getLastRow(),next+9);
   const rows=sheet.getRange(next,1,end-next+1,sheet.getLastColumn()).getValues();
   const log=ss.getSheetByName('TLMS Sync Log');
   for(let i=0;i<rows.length;i++){
    const index=next+i, row=rows[i];
    let result;
    try {
     // Retry transient transaction contention with the same immutable source reference.
     for(let attempt=0;attempt<3;attempt++){
      try{result=acceptRow(row,index,cols);break;}
      catch(error){if(attempt===2 || !/ABORTED|contention|transaction.*abort/i.test(error.message))throw error;Utilities.sleep(250*(attempt+1));}
     }
    }catch(error) {
     if(/Choose|valid|Required|Unknown|ambiguous|invalidate|truck status/i.test(error.message))result='Review in source sheet · '+error.message;
     else throw error;
    }
    log.appendRow([new Date(),index,day(row[cols.date]),String(row[cols.plate]),result]);
    props().setProperty('nextRow',String(index+1));
   }
  }
  refreshViews(ss);recordHealth();
 }catch(error){
  try{recordHealth(error.message);}catch(healthError){console.error('Cannot save sync health');}
  throw error;
 }finally{lock.releaseLock();}
}
function matrixSheet(ss,title,headers,rows,notes) {
 const sheet=ss.getSheetByName(title);
 if(!sheet)throw Error('Missing '+title+'. Run setupTLMS.');
 if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
 if(sheet.getMaxRows()<rows.length+1)sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());
 // These two tabs are managed views. Original response rows remain in the linked tab.
 sheet.clearContents();sheet.clearNotes();
 sheet.getRange(1,1,rows.length+1,headers.length).setValues([headers,...rows]);
 if(rows.length)sheet.getRange(2,1,rows.length,headers.length).setNotes(notes);
 sheet.setFrozenRows(1);sheet.setFrozenColumns(2);
 sheet.getRange(1,1,1,headers.length).setBackground('#17324d').setFontColor('#ffffff').setFontWeight('bold');
 sheet.setColumnWidth(1,235);sheet.setColumnWidth(2,135);
}
function mirrorData(ss) {
 const names=['trucks','drivers','assignment_events','driver_report_days','driver_reports','km_records','schedules','manifests'];
 const sheet=ss.getSheetByName('_TLMS Cache')||ss.insertSheet('_TLMS Cache');
 sheet.hideSheet();
 const saved=sheet.getLastRow()?sheet.getRange(1,1,sheet.getLastRow(),1).getValues().map(row=>row[0]).join(''):'';
 const previous=saved?JSON.parse(saved):null;
 const checkpoint=now();
 const full=!previous || previous.checkpoint.slice(0,10)!==checkpoint.slice(0,10);
 const data={};let changed=full;
 for(const name of names){
  if(full){data[name]=list(name);continue;}
  const field=name==='assignment_events'?'changedAt':'updatedAt';
  const updates=api(':runQuery',{structuredQuery:{from:[{collectionId:name}],where:{fieldFilter:{
   field:{fieldPath:field},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:previous.checkpoint}}}}}).filter(row=>row.document).map(row=>unpack(row.document));
  const count=api(':runAggregationQuery',{structuredAggregationQuery:{structuredQuery:{from:[{collectionId:name}]},aggregations:[{alias:'total',count:{}}]}});
  const total=Number(count[0]?.result?.aggregateFields?.total?.integerValue||0);
  const map=new Map((previous.data[name]||[]).map(row=>[row.id,row]));
  updates.forEach(row=>map.set(row.id,row));
  data[name]=map.size===total?[...map.values()]:list(name);
  if(updates.length||map.size!==total)changed=true;
 }
 if(changed){
  const serialized=JSON.stringify({checkpoint,data});
  const chunks=serialized.match(/[\s\S]{1,40000}/g)||[''];
  if(sheet.getMaxRows()<chunks.length)sheet.insertRowsAfter(sheet.getMaxRows(),chunks.length-sheet.getMaxRows());
  sheet.clearContents();sheet.getRange(1,1,chunks.length,1).setValues(chunks.map(value=>[value]));
 }
 // Keep the previous checkpoint until the cached snapshot has been saved.
 // If there are no changes, querying from the earlier checkpoint remains safe.
 return data;
}
function refreshViews(ss) {
 const data=mirrorData(ss);
 const trucks=sortFleetTrucks(data.trucks.filter(truck=>!truck.isThirdParty));
 const allDrivers=sortManifestDrivers(data.drivers,CONFIG.driverOrder), drivers=allDrivers;
 const events=data.assignment_events,reports=data.driver_report_days,raw=data.driver_reports;
 const meters=data.km_records,schedules=Object.fromEntries(data.schedules.map(s=>[s.date||s.id,s]));
 const stored=data.manifests,manifests=Object.fromEntries(stored.filter(m=>m.confirmed!==false).map(m=>[m.date||m.id,m.tags||{}]));
 let dates=[...new Set([day(new Date()),...reports.map(r=>r.date),...meters.map(r=>r.date),...stored.map(r=>r.date||r.id)])].filter(Boolean).sort();
 if(dates.length){
  const first=Date.parse(dates[0]+'T00:00:00Z'),last=Date.parse(dates[dates.length-1]+'T00:00:00Z');
  if((last-first)/86400000>10000)throw Error('Date range exceeds 10,000 days. Review imported dates.');
  dates=Array.from({length:Math.round((last-first)/86400000)+1},(_,i)=>new Date(first+i*86400000).toISOString().slice(0,10));
 }
 const fingerprint=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
  JSON.stringify([trucks,allDrivers,events,reports,raw.map(r=>[r.id,r.state]),meters,stored,schedules,day(new Date())])));
 if(props().getProperty('viewFingerprint')===fingerprint)return;
 const headers=['Assigned Driver','Truck Plate#',...dates];
 const meterMap=new Map(meters.map(row=>[row.truckId+'_'+row.date,row]));
 const reportMap=new Map(reports.map(row=>[row.truckId+'_'+row.date,row]));
 const kmRows=[],kmNotes=[];
 for(const truck of trucks){
  kmRows.push([allDrivers.find(d=>d.id===truck.assignedDriverId)?.name||truck.assignedDriverName||'Unassigned',truck.plate,...dates.map(date=>{
   const row=meterMap.get(truck.id+'_'+date);return row?.odometerKm??row?.odometer??'';
  })]);
  kmNotes.push(['Current assigned driver','Truck meter history',...dates.map(date=>{
   const r=reportMap.get(truck.id+'_'+date),m=meterMap.get(truck.id+'_'+date);
   return r?'Driver on report date: '+r.driverName+'\nSubmitted: '+r.submittedAt+'\nStatus: '+r.status+
    '\nDaily KM: '+(m?.needsDistanceReview?'Needs review':m?.distanceKm??'')+'\n'+r.reason:'';
  })]);
 }
 matrixSheet(ss,'KM Readings',headers,kmRows,kmNotes);
 const byDriverDate=new Map(),reviewCounts=new Map();
 for(const report of reports){
  const key=report.driverId+'_'+report.date;
  if(!byDriverDate.has(key))byDriverDate.set(key,[]);
  byDriverDate.get(key).push(report);
 }
 for(const report of raw)if(report.state==='review'){
  const key=report.driverId+'_'+report.date;reviewCounts.set(key,(reviewCounts.get(key)||0)+1);
 }
 const manifestRows=[],manifestNotes=[];
 for(const driver of drivers){
  const current=trucks.find(truck=>truck.assignedDriverId===driver.id);
  const history=Object.fromEntries(Object.entries(manifests).filter(([,tags])=>tags[driver.id]).map(([date,tags])=>[date,tags[driver.id]]));
  const notes=['Current driver','Current assigned truck'];
  const values=dates.map(date=>{
   const relevant=byDriverDate.get(driver.id+'_'+date)||[];
   const previousDate=Object.keys(history).filter(d=>d<date).sort().pop();
   if(!manifests[date]?.[driver.id] && !relevant.length && !previousDate &&
      !(schedules[date]?.rows||[]).some(row=>row.driverId===driver.id)){
    notes.push('No report, dispatch or confirmed history for this date.');return '';
   }
   const suggestion=predictSheetManifest(driver,date,schedules,relevant,manifests[date]?.[driver.id],history);
   const submitted=relevant.map(r=>r.plate+' · '+r.status+'\n'+r.submittedAt+'\n'+r.remarks).join('\n');
   const waiting=reviewCounts.get(driver.id+'_'+date)||0;
   notes.push((manifests[date]?.[driver.id]?'Confirmed manifest':'Suggested · needs dispatch review')+
    '\n'+suggestion.reason+'\nDriver report: '+(submitted||'Missing')+(waiting?'\nConflicting reports awaiting review: '+waiting:''));
   return suggestion.text;
  });
  manifestRows.push([driver.name,current?.plate||'Unassigned',...values]);manifestNotes.push(notes);
 }
 matrixSheet(ss,'Daily Follow-up',['Driver Name','Assigned Truck',...dates],manifestRows,manifestNotes);
 const formId=props().getProperty('formId');
 const choices=trucks.filter(truck=>!truck.archived);
 const choiceKey=choices.map(truck=>truck.plate).join('|');
 if(formId && props().getProperty('choiceKey')!==choiceKey) {
  const form=FormApp.openById(formId);
  form.getItems(FormApp.ItemType.LIST).find(item=>item.getTitle()==='Truck Plate Number')?.asListItem().setChoiceValues(choices.map(truck=>truck.plate));
  props().setProperty('choiceKey',choiceKey);
 }
 // Preserve dated source copies for recovery from accidental later edits.
 const today=day(new Date());
 if(props().getProperty('backupDate')!==today){
  const folderId=props().getProperty('backupFolder');
  const folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('TLMS Driver Report Backups');
  props().setProperty('backupFolder',folder.getId());
  folder.createFile('TLMS_'+today+'.json',JSON.stringify({exportedAt:now(),trucks,drivers:allDrivers,assignment_events:events,
   driver_reports:raw,driver_report_days:reports,kmRecords:meters,schedules,manifestDocuments:stored,reportSequences:{driverOrder:CONFIG.driverOrder,truckOrder:CONFIG.truckOrder}}),MimeType.PLAIN_TEXT);
  props().setProperty('backupDate',today);
 }
 props().setProperty('viewFingerprint',fingerprint);
}
export function goToToday() {
 const ss=SpreadsheetApp.openById(CONFIG.sheetId),sheet=ss.getActiveSheet();
 const header=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
 const column=header.indexOf(day(new Date()))+1;
 if(column>0)sheet.setActiveRange(sheet.getRange(1,column));
}

export const integrationTest = {acceptRow,encode,decode,headers,day,mirrorData};

export function onOpen() {
 SpreadsheetApp.getUi().createMenu('TLMS').addItem('Go to today','goToToday').addItem('Sync now','syncTLMS').addToUi();
}
