import type { Driver, Truck, KmRecord, DieselLog } from "../types";

export const normalizePlate = (value: string = "") => {
  const normalized = value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  // Dual-script plates carry the same Latin identifier as English-only KM exports.
  return /[A-Z]/.test(normalized)
    ? normalized.replace(/[^A-Z0-9]/g, "")
    : normalized.replace(/[^0-9\u0600-\u06ff]/g, "");
};
export const normalizeName = (value: string = "") =>
  value.trim().toUpperCase().replace(/\s+/g, " ");
export function resolveTruck(
  trucks: Truck[],
  truckId?: string | null,
  plate?: string,
): Truck | undefined {
  if (truckId) return trucks.find((t) => t.id === truckId);
  const matches = trucks.filter(
    (t) => normalizePlate(t.plate) === normalizePlate(plate),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export function resolveDriver(
  drivers: Driver[],
  driverId?: string | null,
  name?: string,
  iqama?: string,
): Driver | undefined {
  if (driverId) return drivers.find((d) => d.id === driverId);
  const matches = drivers.filter((d) =>
    iqama ? d.iqama === iqama : normalizeName(d.name) === normalizeName(name),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
export const distanceKm = (r: KmRecord) =>
  Math.max(0, Number(r.distanceKm ?? r.km) || 0);
export const odometerKm = (r: KmRecord): number | null => {
  const value = r.odometerKm !== undefined ? r.odometerKm : r.odometer;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
};
export const inPeriod = (date: string, period = "All") =>
  period === "All" || date.startsWith(period);
export const monthlyKmTotal = (records: KmRecord[], period = "All") =>
  records
    .filter((r) => inPeriod(r.date, period))
    .reduce((sum, r) => sum + distanceKm(r), 0);
export const dailyKmValue = (
  records: KmRecord[],
  truckId: string,
  date: string,
) =>
  records.find((r) => r.truckId === truckId && r.date === date)?.distanceKm ??
  0;
export const distanceBetweenReadings = (
  opening: number | null,
  closing: number | null,
) =>
  opening == null || closing == null || closing < opening
    ? null
    : closing - opening;
export function fleetMetrics(
  records: KmRecord[],
  diesel: DieselLog[],
  period = "All",
  truckId?: string,
) {
  const rows = records
    .filter(
      (r) => inPeriod(r.date, period) && (!truckId || r.truckId === truckId),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const meters = rows.map(odometerKm).filter((v): v is number => v !== null);
  const fuel = diesel.filter(
    (r) => inPeriod(r.date, period) && (!truckId || r.truckId === truckId),
  );
  const liters = fuel.reduce((sum, r) => sum + r.liters, 0);
  const km = monthlyKmTotal(rows);
  const opening = meters[0] ?? null;
  const closing = meters.at(-1) ?? null;
  return {
    km,
    liters,
    cost: fuel.reduce((sum, r) => sum + r.cost, 0),
    kmPerLiter: liters > 0 ? km / liters : null,
    opening,
    closing,
    meterDistance: distanceBetweenReadings(opening, closing),
  };
}
export function canonicalKm(
  record: Omit<KmRecord, "id"> | KmRecord,
  trucks: Truck[],
): KmRecord {
  const truck = resolveTruck(trucks, record.truckId, record.veh);
  if (!truck)
    throw new Error(
      `Unmatched or ambiguous truck: ${record.veh || record.truckId}. Add/link it in Master Data before saving.`,
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
    !Number.isFinite(Date.parse(record.date)) ||
    new Date(record.date).toISOString().slice(0, 10) !== record.date
  )
    throw new Error(`Invalid KM date: ${record.date}`);
  const km = record.distanceKm ?? record.km;
  const meter =
    record.odometerKm !== undefined ? record.odometerKm : record.odometer;
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0)
    throw new Error(`Invalid daily KM for ${truck.plate} on ${record.date}`);
  if (
    meter != null &&
    (typeof meter !== "number" || !Number.isFinite(meter) || meter < 0)
  )
    throw new Error(`Invalid odometer for ${truck.plate} on ${record.date}`);
  return {
    ...record,
    id: `${truck.id}_${record.date}`,
    truckId: truck.id,
    veh: truck.plate,
    km,
    distanceKm: km,
    odometer: meter ?? null,
    odometerKm: meter ?? null,
  };
}
/** Canonical records win over legacy duplicates; unresolved records remain visible for migration. */
export function projectKm(records: KmRecord[], trucks: Truck[]) {
  const byKey = new Map<string, KmRecord>();
  for (const raw of records) {
    const truck = resolveTruck(trucks, raw.truckId, raw.veh);
    const record = {
      ...raw,
      truckId: truck?.id ?? raw.truckId,
      veh: truck?.plate ?? raw.veh,
      km: distanceKm(raw),
      distanceKm: distanceKm(raw),
      odometer: odometerKm(raw),
      odometerKm: odometerKm(raw),
    };
    const key = `${truck?.id ?? normalizePlate(raw.veh)}_${raw.date}`;
    const prev = byKey.get(key);
    if (
      !prev ||
      record.id === key ||
      (prev.id !== key &&
        String(record.updatedAt || "").localeCompare(
          String(prev.updatedAt || ""),
        ) > 0)
    )
      byKey.set(key, record);
  }
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date));
}
