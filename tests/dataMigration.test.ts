import test from "node:test";
import assert from "node:assert/strict";
import { buildMigrationPlan } from "../src/utils/dataMigration";
const truck = { id: "t1", plate: "A B C 1234" },
  driver = {
    id: "d1",
    name: "Driver",
    iqama: "123",
    history: { "2026-03-01": "At base" },
  };
test("migration restores history to canonical manifests and links schedule IDs", () => {
  const plan = buildMigrationPlan({
    trucks: [truck],
    drivers: [driver],
    schedules: [
      {
        id: "2026-03-01",
        rows: [
          { id: "r", driverName: "Driver", iqama: "123", plateNo: "ABC1234" },
        ],
      },
    ],
  });
  assert.deepEqual(plan.blockers, []);
  assert.equal(
    plan.writes.find((w) => w.collection === "manifests")?.data.tags.d1,
    "At base",
  );
  assert.deepEqual(
    plan.writes.find((w) => w.collection === "schedules")?.data.rows[0].truckId,
    "t1",
  );
});
test("migration never guesses numeric manifest identities from array positions", () => {
  const source = {
    drivers: [driver],
    manifests: [{ id: "2026-03-02", tags: { 0: "Loading" } }],
  };
  assert.ok(buildMigrationPlan(source).blockers.length);
  assert.equal(buildMigrationPlan(source, { "0": "d1" }).blockers.length, 0);
});
test("conflicting daily duplicates block migration rather than losing data", () => {
  const base = { veh: "ABC1234", date: "2026-03-01", odometer: null };
  const plan = buildMigrationPlan({
    trucks: [truck],
    km_records: [
      { ...base, id: "a", km: 10 },
      { ...base, id: "b", km: 20 },
    ],
  });
  assert.ok(plan.blockers.some((b) => b.includes("Conflicting KM")));
});
