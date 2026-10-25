import {
  canonicalKm,
  normalizePlate,
  resolveDriver,
  resolveTruck,
} from "./fleetAnalytics";
import type { Driver, Truck, KmRecord } from "../types";
export type MigrationWrite = {
  collection: string;
  id: string;
  data: Record<string, any>;
};
export function buildMigrationPlan(
  source: Record<string, any[]>,
  driverIndexMap: Record<string, string> = {},
) {
  const writes: MigrationWrite[] = [],
    blockers: string[] = [];
  const trucks = (source.trucks || []) as Truck[],
    drivers = (source.drivers || []) as Driver[];
  const add = (collection: string, id: string, data: Record<string, any>) =>
    writes.push({ collection, id, data: JSON.parse(JSON.stringify(data)) });
  trucks.forEach((t) =>
    add("trucks", t.id, {
      normalizedPlate: normalizePlate(t.plate),
      plateNorm: normalizePlate(t.plate),
    }),
  );
  const kmById = new Map<string, KmRecord>();
  for (const raw of source.km_records || []) {
    try {
      const row = canonicalKm(raw, trucks),
        prior = kmById.get(row.id);
      if (
        prior &&
        (prior.distanceKm !== row.distanceKm ||
          prior.odometerKm !== row.odometerKm)
      )
        blockers.push(
          `Conflicting KM duplicates for ${row.id}; reconcile explicitly before migration.`,
        );
      else kmById.set(row.id, row);
    } catch (error) {
      blockers.push(`${raw.id}: ${String(error)}`);
    }
  }
  for (const row of kmById.values())
    add("km_records", row.id, {
      ...row,
      source: row.source || "legacy-migration",
    });
  const manifests = new Map<string, Record<string, string>>();
  for (const doc of source.manifests || []) {
    const tags: Record<string, string> = {};
    for (const [key, value] of Object.entries(doc.tags || {})) {
      const id = drivers.some((d) => d.id === key)
        ? key
        : /^\d+$/.test(key)
          ? driverIndexMap[key]
          : key;
      if (!id || !drivers.some((d) => d.id === id)) {
        blockers.push(
          `Manifest ${doc.id}: unresolved driver key ${key}. Supply a reviewed index-to-ID map.`,
        );
        continue;
      }
      tags[id] = String(value);
    }
    manifests.set(doc.date || doc.id, tags);
  }
  for (const d of drivers)
    for (const [date, value] of Object.entries(d.history || {})) {
      const tags = manifests.get(date) || {};
      if (tags[d.id] !== undefined && tags[d.id] !== value)
        blockers.push(`Manifest/history conflict for ${d.id} on ${date}.`);
      else tags[d.id] = value;
      manifests.set(date, tags);
    }
  for (const [date, tags] of manifests) add("manifests", date, { date, tags });
  for (const schedule of source.schedules || []) {
    const rows = (schedule.rows || []).map((r: any) => {
      const d = resolveDriver(drivers, r.driverId, r.driverName, r.iqama),
        t = resolveTruck(trucks, r.truckId, r.plateNo);
      if (r.driverName && !d)
        blockers.push(
          `Schedule ${schedule.id}/${r.id}: unmatched driver ${r.driverName}.`,
        );
      if (r.plateNo && !t)
        blockers.push(
          `Schedule ${schedule.id}/${r.id}: unmatched truck ${r.plateNo}.`,
        );
      return { ...r, driverId: d?.id || null, truckId: t?.id || null };
    });
    add("schedules", schedule.id, { rows });
  }
  for (const log of source.diesel_logs || []) {
    const t = resolveTruck(trucks, log.truckId, log.veh),
      d = resolveDriver(drivers, log.driverId, log.drv);
    if (!t) blockers.push(`Diesel ${log.id}: unmatched truck ${log.veh}.`);
    add("diesel_logs", log.id, {
      truckId: t?.id || null,
      driverId: d?.id || null,
    });
  }
  for (const tx of source.cashbook || []) {
    const matches = (source.cash_accounts || []).filter(
      (a) =>
        a.id === tx.accountId || a.id === tx.account || a.name === tx.account,
    );
    if (matches.length !== 1)
      blockers.push(
        `Cashbook ${tx.id}: missing or ambiguous account ${tx.account}.`,
      );
    else
      add("cashbook", tx.id, {
        accountId: matches[0].id,
        driverId: tx.driverId || null,
        truckId: tx.truckId || null,
      });
  }
  // A parallel registry must be reconciled, never silently seeded over master data.
  const registry = (source.app_state || []).find(
    (d) => d.id === "timetableRegistry",
  );
  for (const d of registry?.drivers || [])
    if (!resolveDriver(drivers, undefined, d.name, d.iqama))
      blockers.push(
        `Legacy timetable driver ${d.id} (${d.name}) must be added/reconciled in Master Data.`,
      );
  for (const v of registry?.vehicles || [])
    if (v.plateNo && !resolveTruck(trucks, undefined, v.plateNo))
      blockers.push(
        `Legacy timetable vehicle ${v.id} (${v.plateNo}) must be added/reconciled in Master Data.`,
      );
  return { writes, blockers: [...new Set(blockers)] };
}
