import { sortFleetTrucks, fleetSequence, compareFleetPlates } from './fleetOrder';
import type { Truck, KmRecord } from '../types';
import { isValidISODate } from './dateUtils';
import { normalizePlate, odometerKm, distanceKm } from './fleetAnalytics';

export type MeterImportRow = {truckId:string;plate:string;odometer:number};
const norm=(value:unknown)=>String(value??'').replace(/^\uFEFF/,'').trim().toLowerCase();
export function parseDailyMeters(matrix: unknown[][], trucks: Truck[], date:string, allowOrdered=false): MeterImportRow[] {
 if(!isValidISODate(date))throw new Error('Choose a valid reading date.');
 trucks=sortFleetTrucks(trucks);
 let rows=matrix.filter(row=>row.some(value=>String(value??'').trim()));
 if(!rows.length)throw new Error('No readings supplied.');
 const first=rows[0].map(norm);
 const plateColumn=first.findIndex(value=>['truck plate#','truck plate','vehicle plate no','plate','plate no'].includes(value));
 const meterColumn=first.findIndex(value=>['opening km','odometer','opening odo','meter reading'].includes(value));
 const dateColumn=first.findIndex(value=>value==='date');
 const valueAt=(value:unknown)=>{
  const text=String(value??'').trim().replace(/,/g,'');
  if(!/^\d+(?:\.\d+)?$/.test(text))throw new Error('Every supplied reading must be a non-negative number; blanks do not clear meters.');
  const number=Number(text);if(!Number.isFinite(number))throw new Error('Invalid meter reading.');
  return number;
 };
 if(plateColumn<0){
  if(!allowOrdered)throw new Error('Values-only paste needs explicit fleet-order confirmation. Plate-labelled files are safer.');
  if(meterColumn>=0)rows=rows.slice(1);
  if(rows.some(row=>row.length!==1))throw new Error('Values-only paste must have exactly one column.');
  if(rows.length!==trucks.length)throw new Error(`Expected exactly ${trucks.length} readings in fleet order; received ${rows.length}.`);
  return rows.map((row,index)=>({truckId:trucks[index].id,plate:trucks[index].plate,odometer:valueAt(row[0])}));
 }
 if(meterColumn<0)throw new Error('File needs an Opening KM or Odometer column.');
 const seen=new Set<string>();
 const result:MeterImportRow[]=[];
 for(const row of rows.slice(1)){
  if(String(row[meterColumn]??'').trim()==='')continue;
  if(dateColumn>=0 && norm(row[dateColumn])!==date)throw new Error('File date must match the selected reading date. Use the date text from the exported template.');
  const plate=normalizePlate(String(row[plateColumn]??''));
  const matches=trucks.filter(truck=>normalizePlate(truck.plate)===plate);
  if(!plate||matches.length!==1)throw new Error(`Unknown or ambiguous truck: ${row[plateColumn]}`);
  const truck=matches[0];
  if(seen.has(truck.id))throw new Error(`Duplicate truck: ${truck.plate}`);
  seen.add(truck.id);result.push({truckId:truck.id,plate:truck.plate,odometer:valueAt(row[meterColumn])});
 }
 if(!result.length)throw new Error('No populated readings found.');
 return result.sort((a,b)=>compareFleetPlates(a.plate,b.plate));
}

export function dailyMeterExport(trucks:Truck[], records:KmRecord[],date:string){
 if(!isValidISODate(date))throw new Error('Choose a valid reading date.');
 trucks=sortFleetTrucks(trucks);
 return trucks.map((truck,index)=>{
  const row=records.find(record=>record.truckId===truck.id&&record.date===date);
  return {'SL#':fleetSequence(truck.plate) ?? index+1,'Truck Plate#':truck.plate,Date:date,'Opening KM':row ? odometerKm(row) : null,'Daily KM Run':row ? distanceKm(row) : null};
 });
}
