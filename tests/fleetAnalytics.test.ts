import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalKm,
  fleetMetrics,
  normalizePlate,
  projectKm,
  resolveDriver,
  resolveTruck,
  monthlyKmTotal,
} from "../src/utils/fleetAnalytics";
import type { Truck, KmRecord, Driver } from "../src/types";
const truck = {
  id: "truck-1",
  plate: "J S A 8752",
  plateNorm: "stale",
} as Truck;
const record = (patch: Partial<KmRecord> = {}) =>
  canonicalKm(
    {
      date: "2026-03-01",
      veh: "j-s-a 8752",
      km: 500,
      odometer: null,
      ...patch,
    },
    [truck],
  );
test("canonical IDs survive plate changes and normalize formatting", () => {
  assert.equal(normalizePlate(" j-s-a 8752 "), "JSA8752");
  const r = record();
  assert.equal(r.id, "truck-1_2026-03-01");
  assert.equal(r.distanceKm, 500);
  assert.equal(r.odometerKm, null);
  const renamed = { ...truck, plate: "NEW 1234" };
  assert.equal(canonicalKm(r, [renamed]).id, r.id);
  assert.equal(canonicalKm(r, [renamed]).veh, "NEW 1234");
});
test("invalid or ambiguous relationships cannot be silently assigned", () => {
  assert.equal(
    resolveTruck([truck, { ...truck, id: "other" }], undefined, truck.plate),
    undefined,
  );
  assert.throws(() => record({ veh: "UNKNOWN 9" }), /Unmatched/);
  assert.throws(() => record({ truckId: "missing" }), /Unmatched/);
  assert.equal(
    resolveDriver(
      [
        { id: "a", name: "Same" },
        { id: "b", name: "Same" },
      ] as Driver[],
      undefined,
      "Same",
    ),
    undefined,
  );
});
test("negative/nonfinite distance and invalid dates/meters are rejected", () => {
  for (const km of [-1, NaN, Infinity]) assert.throws(() => record({ km }));
  for (const date of ["2026-02-30", "not-a-date"])
    assert.throws(() => record({ date }));
  assert.throws(() => record({ odometer: -1 }));
  assert.equal(record({ odometer: 0 }).odometerKm, 0);
});
test("a real zero odometer is distinct from missing meter, distance stays independent", () => {
  const data = [
    record({ odometer: 0 }),
    record({ date: "2026-03-02", km: 200, odometer: 1000 }),
  ];
  const metrics = fleetMetrics(data, [], "2026-03", truck.id);
  assert.deepEqual(
    [metrics.km, metrics.opening, metrics.closing, metrics.meterDistance],
    [700, 0, 1000, 1000],
  );
  assert.equal(fleetMetrics([record()], []).opening, null);
});
test("all consumers aggregate canonical records once and filter by IDs and period", () => {
  const canonical = record();
  const legacy = {
    ...canonical,
    id: "old",
    km: 900,
    distanceKm: 900,
    updatedAt: "2099-01-01",
  };
  const rows = projectKm(
    [legacy, canonical, record({ date: "2026-04-01", km: 100 })],
    [truck],
  );
  assert.equal(rows.length, 2);
  assert.equal(monthlyKmTotal(rows, "2026-03"), 500);
  const fuel = [
    {
      id: "f",
      truckId: truck.id,
      date: "2026-03-01",
      veh: truck.plate,
      drv: "",
      liters: 100,
      cost: 179,
      route: "",
    },
  ];
  assert.deepEqual(fleetMetrics(rows, fuel, "2026-03", truck.id), {
    km: 500,
    liters: 100,
    cost: 179,
    kmPerLiter: 5,
    opening: null,
    closing: null,
    meterDistance: null,
  });
});
test("unmatched legacy KM records are retained for explicit migration reporting", () => {
  const rows = projectKm(
    [{ id: "old", veh: "UNKNOWN", date: "2026-03-01", km: 10, odometer: null }],
    [],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].truckId, undefined);
});
