import { fleetSequence } from './fleetOrder';

export function sortFleetTrucks<T extends {plate:string;id:string;createdAt?:string;seq?:number}>(trucks: readonly T[]) {
 return [...trucks].sort((a,b) =>
  (fleetSequence(a.plate) ?? 9999) - (fleetSequence(b.plate) ?? 9999) ||
  (a.createdAt || '').localeCompare(b.createdAt || '') || (a.seq || 0) - (b.seq || 0) || a.id.localeCompare(b.id));
}
