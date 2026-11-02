import {normalizePlate} from './fleetAnalytics';

/** Dispatcher-approved fleet sequence. Identity always remains the saved truck ID. */
export const FLEET_PLATE_SEQUENCE = [
 'D J A 4827','D J A 4828','D J A 4829',
 'K R A 7501','K R A 7502','K R A 7503','K R A 8469','K R A 8470','K R A 8471','K R A 8477','K R A 8478','K R A 8479',
 'J R A 5158','J R A 5159','J R A 5160','J R A 5165','J R A 5170',
 'J S A 8647','J S A 8648','J S A 8649','J S A 8650','J S A 8751','J S A 8752','J S A 8753','J S A 8754',
 'G R A 6844','G R A 6845',
 'S S A 5046','S S A 5048','S S A 1192','S S A 1193','S S A 1194','S S A 1195','S S A 1196','S S A 1197','S S A 1198','S S A 1199',
 'H X A 3589','H X A 3590','H X A 3591','H X A 3592','H X A 3593','H X A 3594','H X A 3595','H X A 3596','H X A 3597','H X A 3598'
] as const;
const rank = new Map<string,number>(FLEET_PLATE_SEQUENCE.map((plate,index)=>[normalizePlate(plate),index+1]));
export const fleetSequence=(plate:string):number|undefined=>rank.get(normalizePlate(plate));
export function compareFleetPlates(a:string,b:string):number{
 const first=fleetSequence(a) ?? Number.MAX_SAFE_INTEGER;
 const second=fleetSequence(b) ?? Number.MAX_SAFE_INTEGER;
 return first-second || (first===Number.MAX_SAFE_INTEGER ? normalizePlate(a).localeCompare(normalizePlate(b),undefined,{numeric:true}) : 0);
}
export function sortFleetTrucks<T extends {plate:string;id:string}>(trucks:readonly T[]):T[]{
 return [...trucks].sort((a,b)=>compareFleetPlates(a.plate,b.plate)||a.id.localeCompare(b.id));
}
export function missingFleetPlates(trucks:readonly {plate:string}[]):string[]{
 const saved=new Set(trucks.map(truck=>normalizePlate(truck.plate)));
 return FLEET_PLATE_SEQUENCE.filter(plate=>!saved.has(normalizePlate(plate)));
}
