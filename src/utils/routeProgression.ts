import type {TimetableRow,Driver,DailySchedule,ManifestSuggestion} from '../types';
import {isWarehouseTransfer,isInternalTransfer,manifestActivity,normalizeDispatchParties,scheduleRowsForDriver} from './dispatchManifest';
import {shiftISODate,isValidISODate} from './dateUtils';
export type Stage='loading'|'transit'|'waiting'|'border'|'offloading'|'returning'|'idle';
export type Activity={text:string;stem:string;commodity:string;kind:string;stage:Stage|null;location:string};
export type Route={kind:string;commodity:string;source:string;destination:string};
export type Observation={date:string;route:Route;stage:Stage;age:number;next:Stage};
export type TransitionModel={version:number;through:string;observations:number;counts:Record<string,Partial<Record<Stage,number>>>};
export const normalized=(value:string)=>String(value||'').toUpperCase().replace(/SULPHER|SULFUR/g,'SULPHUR').replace(/\s+/g,' ').trim();
export function city(value:string){
 const n=normalized(value).replace(/[()]/g,' ').replace(/\b(?:WH|WAREHOUSE)\b/g,'').trim();
 return /^(TLS|TPF|LOCAL|YANBU|YANBU - LOCAL)$/.test(n)?'YANBU':n;
}
export function material(value:string){
 const n=normalized(value.split('/')[0]).trim();
 const aliases:Record<string,string>={'CAUSTIC SODA':'CS','FERRIC CHLORIDE':'FC','HYDROCHLORIC ACID':'HCL','SULPHURIC ACID':'SA','SULFURIC ACID':'SA','SODIUM BISULPHITE':'SBS','SODIUM BISULPHATE':'SBS','SODIUM METABISULPHITE':'SMBS','SODIUM METABISULPHATE':'SMBS','SOP POWDER':'SOP','SOP GRANULAR':'SOP'};
 return aliases[n]||n;
}
export function activities(tag:string):Activity[]{
 return String(tag||'').split(/\s+\/\s+/).map(text=>{
  text=text.trim();const n=normalized(text);
  let stage:Stage|null=null;
  if(/WAITING.*OFFLOAD/.test(n))stage='waiting';
  else if(/BORDER/.test(n))stage='border';
  else if(/UNDER OFFLOAD|UNLOADING/.test(n) || /(?:^| - )OFFLOADING(?:$| AT | COMPLETED\b)/.test(n))stage='offloading';
  else if(/UNDER LOAD|LOADING AT/.test(n))stage='loading';
  else if(/ON THE WAY|EN ROUTE/.test(n))stage='transit';
  else if(/COMING BACK|RETURNING/.test(n))stage='returning';
  else if(/^(AT |ARRIVED|STANDBY)/.test(n))stage='idle';
  let stem=normalized(text.split(/\s+-\s+/)[0]).replace(/\bTO\b/g,'').replace(/\s+/g,' ').trim();
  const rawMaterial=text.split(/\s+(?:SUPPLY|TRANSFER|COLLECTION)\b/i)[0];
  const commodity=material(rawMaterial);
  if(stem.startsWith(normalized(rawMaterial)))stem=commodity+stem.slice(normalized(rawMaterial).length);
  const kind=/INTERNAL TRANSFER/.test(n)?'internal':/COLLECTION FROM/.test(n)?'collection':/TRANSFER.*\bWH\b|WAREHOUSE/.test(n)?'warehouse':/SUPPLY FOR/.test(n)?'supply':'status';
  const location=/\b(?:at|to)\s+(.+)$/i.exec(text)?.[1]?.trim()||'';
  return {text,stem,commodity,kind,stage,location};
 }).filter(activity=>activity.text);
}
export function routeFor(row:TimetableRow):Route{
 const r=normalizeDispatchParties(row);
 return {kind:isInternalTransfer(r)?'internal':r.supplier?.trim()?'collection':isWarehouseTransfer(r)?'warehouse':'supply',commodity:material(r.commodity),source:city(r.source),destination:city(r.destination)};
}
const tiers=(route:Route,stage:Stage,age:number)=>[
 ['material',route.kind,route.commodity,route.source,route.destination,stage,Math.min(age,7)],
 ['route',route.kind,route.source,route.destination,stage,Math.min(age,7)],
 ['destination',route.kind,route.destination,stage,Math.min(age,7)],
 ['general',route.kind,stage,Math.min(age,7)]
].map(parts=>JSON.stringify(parts));
export function trainTransitions(observations:Observation[]):TransitionModel{
 const counts:TransitionModel['counts']={};
 observations.forEach(item=>tiers(item.route,item.stage,item.age).forEach(key=>{
  const group=counts[key]||={};group[item.next]=(group[item.next]||0)+1;
 }));
 return {version:1,through:observations.map(item=>item.date).sort().at(-1)||'',observations:observations.length,counts};
}
export function selectTransition(model:TransitionModel,route:Route,stage:Stage,age:number,destinationOnly=false){
 for(const [index,key]of tiers(route,stage,age).entries()){
  if(destinationOnly && index!==2)continue;
  const counts=model.counts[key];if(!counts)continue;
  const options=Object.entries(counts).sort((a,b)=>(b[1]||0)-(a[1]||0));
  const total=options.reduce((sum,[,count])=>sum+(count||0),0),best=options[0];
  if(best&&total>=(index<3?3:20)&&(best[1]||0)/total>=(index<3?0.6:0.7))
   return {next:best[0] as Stage,support:total,confidence:(best[1]||0)/total,specific:index<3};
 }
 return null;
}
export interface HistoryRow{driver:string;date:string;tag:string}
export interface ScheduleHistoryRow extends Partial<TimetableRow>{driver:string;date:string}
/** Cross-match a single unambiguous dispatch to a confirmed activity; never use a reused truck plate. */
export function extractTransitionObservations(records:HistoryRow[],schedules:ScheduleHistoryRow[]):{observations:Observation[];matched:number;ambiguous:number}{
 const dispatch=new Map<string,ScheduleHistoryRow[]>();
 schedules.forEach(row=>{const key=row.driver+'|'+row.date;dispatch.set(key,[...(dispatch.get(key)||[]),row]);});
 const histories=new Map<string,HistoryRow[]>();
 records.forEach(row=>{if(isValidISODate(row.date))histories.set(row.driver,[...(histories.get(row.driver)||[]),row]);});
 const observations:Observation[]=[];let matched=0,ambiguous=0;
 histories.forEach(history=>{
  history.sort((a,b)=>a.date.localeCompare(b.date));
  const anchors=new Map<string,{route:Route;date:string}>();
  const ages=new Map<string,{date:string;stage:Stage;age:number}>();
  let lastAnchor:{route:Route;date:string}|undefined;
  history.forEach((row,index)=>{
   const current=activities(row.tag),nextRow=history[index+1];
   for(const activity of current){
    if(!activity.stage||!(['supply','warehouse'].includes(activity.kind)||activity.stage==='returning'))continue;
    const candidates=(dispatch.get(row.driver+'|'+row.date)||[]).filter(candidate=>{
     const route=routeFor(candidate as TimetableRow);
     return route.kind===activity.kind&&route.commodity===activity.commodity;
    });
    const routes=new Map(candidates.map(candidate=>{const route=routeFor(candidate as TimetableRow);return[JSON.stringify(route),route];}));
    if(routes.size===1){lastAnchor={route:[...routes.values()][0],date:row.date};anchors.set(activity.stem,lastAnchor);matched++;}
    else if(routes.size>1){ambiguous++;continue;}
    const anchor=anchors.get(activity.stem)||(activity.stage==='returning'?lastAnchor:undefined);
    const prior=ages.get(activity.stem);
    const age=prior&&prior.stage===activity.stage&&shiftISODate(prior.date,1)===row.date?prior.age+1:1;
    ages.set(activity.stem,{date:row.date,stage:activity.stage,age});
    if(!anchor||!nextRow||shiftISODate(row.date,1)!==nextRow.date||row.date>shiftISODate(anchor.date,21))continue;
    // On-road/offloading place must agree with the dispatch destination.
    if(['transit','waiting','offloading'].includes(activity.stage)&&city(activity.location)!==anchor.route.destination)continue;
    const nextActivities=activities(nextRow.tag),same=nextActivities.filter(item=>item.stem===activity.stem);
    let next=same.length===1?same[0]:null;
    if(!next&&nextActivities.length===1&&['idle','returning'].includes(nextActivities[0].stage||''))next=nextActivities[0];
    if(!next?.stage)continue;
    observations.push({date:nextRow.date,route:anchor.route,stage:activity.stage,age,next:next.stage});
   }
  });
 });
 return {observations,matched,ambiguous};
}
export function renderStage(activity:Activity,route:Route,stage:Stage):string{
 const prefix=activity.text.split(/\s+-\s+/)[0];
 if(stage==='idle')return 'At Yanbu';
 if(stage==='returning')return 'Coming Back to Yanbu';
 const destination=route.destination.replace(/\b\w/g,letter=>letter.toUpperCase()).toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
 const source=route.source.toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
 const suffix={loading:'Under Loading at '+source,transit:'On the way to '+destination,waiting:'Waiting for Offloading at '+destination,border:'At '+destination+' Border',offloading:'Under Offloading at '+destination}[stage];
 return prefix+' - '+suffix;
}

export function liveTransitionModel(base:TransitionModel,drivers:Driver[],schedules:Record<string,DailySchedule>,manifests:Record<string,Record<string,string>>,date:string):TransitionModel{
 const futureReference=date>base.through;
 const hasFresh=Object.keys(manifests).some(day=>day>base.through&&day<date) ||
   drivers.some(driver=>Object.keys(driver.history||{}).some(day=>day>base.through&&day<date));
 if(futureReference&&!hasFresh)return base;
 const earliest=futureReference?shiftISODate(base.through,-21):'';
 const records=new Map<string,HistoryRow>();
 drivers.forEach(driver=>Object.entries(driver.history||{}).forEach(([day,tag])=>{
  if(day<date&&day>=earliest)records.set(driver.id+'|'+day,{driver:driver.id,date:day,tag});
 }));
 Object.entries(manifests).forEach(([day,tags])=>{
  if(day>=date||day<earliest)return;
  drivers.forEach(driver=>{if(tags[driver.id])records.set(driver.id+'|'+day,{driver:driver.id,date:day,tag:tags[driver.id]});});
 });
 const dispatch:ScheduleHistoryRow[]=[];
 Object.entries(schedules).forEach(([day,schedule])=>{
  if(day>=date||day<earliest)return;
  drivers.forEach(driver=>scheduleRowsForDriver(driver,schedule.rows).forEach(row=>dispatch.push({...row,driver:driver.id,date:day})));
 });
 const extracted=extractTransitionObservations([...records.values()],dispatch);
 // Never train a past-date prediction with later observations from the reference file.
 if(date<=base.through)return trainTransitions(extracted.observations);
 const fresh=trainTransitions(extracted.observations.filter(row=>row.date>base.through));
 const counts:TransitionModel['counts']=Object.fromEntries(Object.entries(base.counts).map(([key,value])=>[key,{...value}]));
 Object.entries(fresh.counts).forEach(([key,values])=>{
  const group=counts[key]||={};
  Object.entries(values).forEach(([stage,count])=>group[stage as Stage]=(group[stage as Stage]||0)+(count||0));
 });
 return {...base,counts,observations:base.observations+fresh.observations,through:fresh.through>base.through?fresh.through:base.through};
}

export function predictRouteProgression(driver:Driver,date:string,previousTag:string,currentRows:TimetableRow[],schedules:Record<string,DailySchedule>,model:TransitionModel):ManifestSuggestion|null{
 const history=driver.history||{};
 const previousDate=Object.keys(history).filter(day=>day<date && history[day]?.trim()).sort().at(-1);
 if(!previousDate||shiftISODate(previousDate,1)!==date)return null;
 const previous=activities(previousTag);
 if (!currentRows.length && previous.length && previous.every(activity => activity.stage === 'offloading')) {
  return {
   text: 'Coming Back to Yanbu',
   conf: 'medium',
   reason: 'Yesterday’s manifest recorded offloading and today has no matching dispatch. Confirm the return with the driver.'
  };
 }
 const earlierTag=Object.entries(history).filter(([day])=>day<previousDate).sort(([a],[b])=>b.localeCompare(a))[0]?.[1]||'';
 const earlierActivities=activities(earlierTag).filter(activity=>['supply','warehouse'].includes(activity.kind)&&activity.stage);
 const earlierActivity=earlierActivities.length===1?earlierActivities[0]:undefined;
 const past=Object.entries(schedules).filter(([day])=>day<date&&day>=shiftISODate(date,-21)).sort(([a],[b])=>b.localeCompare(a))
  .flatMap(([day,schedule])=>scheduleRowsForDriver(driver,schedule.rows).map(row=>({day,row})));
 const warnings:string[]=[];
 const predict=(activity:Activity,planned?:TimetableRow):string=>{
  const returning=activity.stage==='returning';
  if(returning&&earlierActivity)activity={...activity,kind:earlierActivity.kind,commodity:earlierActivity.commodity,stem:earlierActivity.stem};
  if(!activity.stage||!['supply','warehouse'].includes(activity.kind))return planned?manifestActivity(planned):activity.text;
  const compatible=past.filter(({row})=>{const route=routeFor(row);return route.kind===activity.kind&&route.commodity===activity.commodity;});
  const exact=compatible.filter(({row})=>activities(manifestActivity(row))[0]?.stem===activity.stem);
  const candidates=exact;
  const latest=candidates[0]?.day;
  const routes=new Map(candidates.filter(item=>item.day===latest).map(({row})=>{const route=routeFor(row);return [JSON.stringify(route),route];}));
  const dispatchRoute=planned?routeFor(planned):routes.size===1?[...routes.values()][0]:undefined;
  const recordedDestination=routes.size===0 && ['transit','waiting','offloading'].includes(activity.stage) ? city(activity.location) : '';
  const route=dispatchRoute || (recordedDestination ? {kind:activity.kind,commodity:activity.commodity,source:'',destination:recordedDestination} : undefined);
  // Yesterday's loading entry can suggest travel even without route statistics.
  // Only yesterday's matching dispatch can supply a destination for this fallback.
  const fallbackTravel = () => {
   const destination = latest === previousDate ? dispatchRoute?.destination : '';
   warnings.push('Yesterday’s manifest recorded loading. Dispatcher review required to confirm travel.');
   if (destination && dispatchRoute) return renderStage(activity, dispatchRoute, 'transit');
   return activity.text.replace(/(?:under )?loading(?: at .*)?$/i, 'On the way');
  };
  const useLoadingFallback = activity.stage === 'loading' && !currentRows.length;
  if (!route && useLoadingFallback) return fallbackTravel();
  if(!route){warnings.push('Route is ambiguous; review required.');return activity.text;}
  if(['transit','waiting','offloading'].includes(activity.stage)&&city(activity.location)!==route.destination){
   warnings.push('Recorded location differs from route destination; review required.');return activity.text;
  }
  let age=0,day=previousDate;
  while(history[day]){
   const matches=activities(history[day]).filter(item=>item.stage===activity.stage&&(returning||item.stem===activity.stem));
   if(matches.length!==1)break;age++;day=shiftISODate(day,-1);
  }
  const result=selectTransition(model,route,activity.stage,Math.max(age,1),!dispatchRoute);
  if (!result && useLoadingFallback) return fallbackTravel();
  if(!result||(!dispatchRoute&&result.next==='loading')){warnings.push('Insufficient route history; previous activity needs review.');return activity.text;}
  warnings.push(`${dispatchRoute ? route.source+' → ' : 'Recorded destination '}${route.destination}, ${activity.kind}, day ${age||1} in ${activity.stage}: ${result.support} historical transitions, ${Math.round(result.confidence*100)}% chose ${result.next}.`);
  return renderStage(activity,route,result.next);
 };
 if(currentRows.length){
  const texts=currentRows.map(row=>{
   const planned=activities(manifestActivity(row))[0];
   if(!planned||!['supply','warehouse'].includes(planned.kind))return manifestActivity(row);
   const waybill=String(row.waybill||'').trim();
   const knownWaybill=waybill&&past.some(item=>String(item.row.waybill||'').trim()===waybill);
   const exactPrior=previous.filter(activity=>activity.stem===planned.stem&&activity.stage);
   const prior=exactPrior.length?exactPrior:knownWaybill?previous.filter(activity=>activity.kind===planned.kind&&activity.commodity===planned.commodity&&activity.stage):[];
   const newWaybill=waybill&&!knownWaybill;
   const priorPlan=past.find(item=>activities(manifestActivity(item.row))[0]?.stem===planned.stem);
   const routeChanged=priorPlan&&JSON.stringify(routeFor(priorPlan.row))!==JSON.stringify(routeFor(row));
   if(prior.length===1&&!newWaybill&&!routeChanged)return predict(prior[0],row);
   warnings.push(newWaybill?'New waybill starts a new dispatch draft.':'New or unmatched dispatch starts a loading draft.');
   return manifestActivity(row);
  });
  return {text:texts.join(' / '),conf:warnings.some(reason=>/review required|Insufficient/.test(reason))?'low':'medium',reason:'Suggested, not confirmed. '+warnings.join(' ')};
 }
 const relevant=previous.filter(activity=>activity.stage&&(['supply','warehouse'].includes(activity.kind)||(activity.stage==='returning'&&earlierActivity)));
 if(!relevant.length)return null;
 const texts=previous.map(activity=>predict(activity));
 return {text:texts.join(' / '),conf:warnings.some(reason=>/review required|Insufficient/.test(reason))?'low':'medium',reason:'Suggested, not confirmed. '+warnings.join(' ')};
}
