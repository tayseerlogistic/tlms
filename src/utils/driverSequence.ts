import type { Driver } from '../types';

const key = (name: string) => name.toUpperCase().replace(/\s+/g, ' ').trim();
export function manifestDriverRank(name: string, order: string[] = []) {
 const index = order.findIndex(item => key(item) === key(name));
 return index < 0 ? undefined : index;
}
export function sortManifestDrivers(drivers: Driver[], order: string[] = []) {
 return [...drivers].sort((a,b) =>
  (a.manifestOrder ?? manifestDriverRank(a.name,order) ?? 9999) -
   (b.manifestOrder ?? manifestDriverRank(b.name,order) ?? 9999) ||
  (a.createdAt || '').localeCompare(b.createdAt || '') || a.seq - b.seq || a.id.localeCompare(b.id));
}
