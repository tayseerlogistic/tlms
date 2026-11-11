import { manifestCustomer } from './manifestCustomer';
import type { Driver, TimetableRow } from '../types';

const norm = (value: unknown) => String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
const digits = (value: unknown) => String(value || '').replace(/\D/g, '');
const plant = (value: unknown) => norm(value).replace(/[^A-Z]/g, '');
const ownPlant = (value: unknown) => ['TLS', 'TPF', 'TLSTPF', 'TPFTLS'].includes(plant(value));

export function isInternalTransfer(row: Pick<TimetableRow, 'source' | 'destination'>): boolean {
  const source = plant(row.source), destination = plant(row.destination);
  return ['TLSTPF', 'TPFTLS'].includes(source) ||
    (ownPlant(source) && ownPlant(destination));
}

export function supplierForCommodity(commodity: string, party: string): string | null {
  const material = norm(commodity.split('/')[0]);
  const name = norm(party);
  if (/TRONOX/.test(name) && /^(CS\b|CAUSTIC SODA\b)/.test(material)) return 'TRONOX';
  if (/YASREF/.test(name) && /SULPH[UE]R/.test(material) && !/ACID/.test(material)) return 'YASREF';
  if (/LUBEREF/.test(name) && /SULPH[UE]R/.test(material) && !/ACID/.test(material)) return 'LUBEREF';
  return null;
}

/** Infer a supplier only from the loading end; a refinery can also be a customer. */
export function normalizeDispatchParties<T extends Pick<TimetableRow, 'source' | 'destination' | 'commodity' | 'supplier' | 'customer'>>(row: T): T {
  if (isInternalTransfer(row) || row.supplier?.trim()) return row;
  const fromSource = supplierForCommodity(row.commodity, row.source);
  const fromCustomer = ownPlant(row.destination) && !ownPlant(row.source)
    ? supplierForCommodity(row.commodity, row.customer) : null;
  const supplier = fromSource || fromCustomer;
  if (!supplier) return row;
  return { ...row, supplier, customer: supplierForCommodity(row.commodity, row.customer) === supplier ? '' : row.customer };
}

/** Strong identities take precedence. Never match another driver's explicit ID by plate. */
export function scheduleRowsForDriver(driver: Driver, rows: TimetableRow[]): TimetableRow[] {
  return rows.filter(row => {
    if (row.driverId) return row.driverId === driver.id;
    const iqama = digits(row.iqama);
    if (iqama && digits(driver.iqama)) return iqama === digits(driver.iqama);
    return Boolean(norm(driver.name) && norm(row.driverName) === norm(driver.name));
  });
}

export function isWarehouseTransfer(row: Pick<TimetableRow, 'customer'|'supplier'|'store'|'destination'>): boolean {
  return !row.supplier?.trim() && /\bWH\b|WAREHOUSE/i.test([row.store,row.destination,row.customer].join(' ')) &&
    (!row.customer?.trim() || /TAYSEER|^TLS\b|^TPF\b/i.test(row.customer));
}

export function manifestActivity(input: TimetableRow): string {
  const row = normalizeDispatchParties(input);
  if (isInternalTransfer(row)) return 'Internal Transfer';
  const commodity = row.commodity?.split('/')[0]?.trim() || 'Commodity';
  const supplier = row.supplier?.trim();
  if (supplier) {
    const canonical = supplierForCommodity(row.commodity, supplier);
    const material = canonical === 'TRONOX' ? 'CS' : commodity;
    return `${material} Collection from ${canonical || supplier}`;
  }
  if (isWarehouseTransfer(row)) return `${commodity} Transfer ${row.destination?.trim() || 'Destination'} WH - Under Loading at ${row.source?.trim() || 'Yanbu'}`;
  return `${commodity} Supply for ${manifestCustomer(row.customer?.trim() || '') || row.store?.trim() || 'Customer'} - Under Loading at ${row.source?.trim() || 'Yanbu'}`;
}

/** Keep every schedule row, including repeat trips with identical descriptions. */
export function manifestForTrips(rows: TimetableRow[]): string {
  return rows.map(manifestActivity).join(' / ');
}

export function scheduleManifestTags(rows: TimetableRow[]): Record<string, string> {
  const grouped = new Map<string, TimetableRow[]>();
  for (const row of rows) {
    if (!row.driverId) continue;
    grouped.set(row.driverId, [...(grouped.get(row.driverId) || []), row]);
  }
  return Object.fromEntries([...grouped].map(([id, trips]) => [id, manifestForTrips(trips)]));
}
