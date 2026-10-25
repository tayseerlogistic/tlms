import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, type Firestore } from "firebase/firestore";
let env: RulesTestEnvironment;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tlms",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "trucks", "t1"), {
      plate: "A 123",
      id: "t1",
    });
  });
});
after(async () => {
  await env?.cleanup();
});
const admin = () =>
  env
    .authenticatedContext("admin", { email: "tayseerlogistic@gmail.com" })
    .firestore();
const km = {
  truckId: "t1",
  date: "2026-03-01",
  veh: "A 123",
  distanceKm: 20,
  km: 20,
  odometerKm: null,
  odometer: null,
};
test("unauthenticated production reads and writes are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "trucks", "t1")));
  await assertFails(setDoc(doc(db, "km_records", "t1_2026-03-01"), km));
});
test("valid canonical KM with missing or zero odometer is accepted", async () => {
  await assertSucceeds(setDoc(doc(admin(), "km_records", "t1_2026-03-01"), km));
  await assertSucceeds(
    setDoc(doc(admin(), "km_records", "t1_2026-03-01"), {
      ...km,
      odometerKm: 0,
      odometer: 0,
    }),
  );
});
test("duplicates, negatives, missing trucks and inconsistent aliases are rejected", async () => {
  await assertFails(setDoc(doc(admin(), "km_records", "other-id"), km));
  await assertFails(
    setDoc(doc(admin(), "km_records", "t1_2026-03-01"), {
      ...km,
      distanceKm: -1,
      km: -1,
    }),
  );
  await assertFails(
    setDoc(doc(admin(), "km_records", "t1_2026-03-01"), {
      ...km,
      odometerKm: -1,
      odometer: -1,
    }),
  );
  await assertFails(
    setDoc(doc(admin(), "km_records", "t1_2026-03-01"), { ...km, km: 99 }),
  );
  await assertFails(
    setDoc(doc(admin(), "km_records", "missing_2026-03-01"), {
      ...km,
      truckId: "missing",
    }),
  );
});
test("required auxiliary collections and import ledger are authorized", async () => {
  for (const name of ["commodities", "stores", "data_quality"])
    await assertSucceeds(setDoc(doc(admin(), name, "sample"), { value: 1 }));
  await assertSucceeds(
    setDoc(doc(admin(), "app_state", "branding"), { brandName: "TLMS" }),
  );
  await assertFails(
    setDoc(doc(admin(), "app_state", "timetableRegistry"), { drivers: [] }),
  );
  await assertSucceeds(
    setDoc(doc(admin(), "import_batches", "batch1"), {
      createdBy: "admin",
      expectedRecordCount: 2,
      persistedRecordCount: 0,
      status: "running",
    }),
  );
  await assertSucceeds(
    setDoc(doc(admin(), "import_batches", "batch1"), {
      createdBy: "admin",
      expectedRecordCount: 2,
      persistedRecordCount: 2,
      status: "completed",
    }),
  );
  await assertFails(
    setDoc(doc(admin(), "import_batches", "batch1"), {
      createdBy: "admin",
      expectedRecordCount: 2,
      persistedRecordCount: 3,
      status: "completed",
    }),
  );
});

test("archived drivers cannot be assigned to active trucks", async () => {
  await assertSucceeds(
    setDoc(doc(admin(), "drivers", "archived"), {
      name: "Former driver",
      active: false,
    }),
  );
  await assertFails(
    setDoc(doc(admin(), "trucks", "t2"), {
      plate: "B 456",
      assignedDriverId: "archived",
    }),
  );
  await assertSucceeds(
    setDoc(doc(admin(), "trucks", "t2"), {
      plate: "B 456",
      assignedDriverId: null,
    }),
  );
});

test("repository imports are verified on the emulator and meter/distance patches stay independent", async () => {
  const { createFleetRepository } =
    await import("../../src/services/fleetRepository");
  const repo = createFleetRepository((admin() as unknown as { _delegate: Firestore })._delegate, () => "admin");
  const truck = {
    id: "t1",
    plate: "A 123",
    plateNorm: "A123",
  } as import("../../src/types").Truck;
  const result = await repo.importKm(
    [{ veh: "A123", date: "2026-04-01", km: 100, odometer: null }],
    [truck],
  );
  if (result.status !== "completed") throw new Error(JSON.stringify(result));
  const base = {
    id: "t1_2026-04-01",
    truckId: "t1",
    veh: "A 123",
    date: "2026-04-01",
    km: 100,
    distanceKm: 100,
    odometer: null,
    odometerKm: null,
  };
  await Promise.all([
    repo.updateKmFields(base, { distanceKm: 150 }, [truck]),
    repo.updateKmFields(base, { odometerKm: 40000 }, [truck]),
  ]);
  const saved = (await getDoc(doc(admin(), "km_records", base.id))).data();
  if (saved?.distanceKm !== 150 || saved?.odometerKm !== 40000)
    throw new Error(`Independent patches lost data: ${JSON.stringify(saved)}`);
  const repeat = await repo.importKm(
    [{ ...base, distanceKm: 150, km: 150, odometerKm: 40000, odometer: 40000 }],
    [truck],
  );
  if (repeat.persistedRecordCount !== 1)
    throw new Error("Retry was not verified");
});

test("repository listener receives another authenticated session write and deletion", async () => {
  const { createFleetRepository } =
    await import("../../src/services/fleetRepository");
  const other = env
    .authenticatedContext("other-admin", { email: "tayseerlogistic@gmail.com" })
    .firestore();
  const reader = createFleetRepository((admin() as unknown as { _delegate: Firestore })._delegate, () => "admin"),
    writer = createFleetRepository((other as unknown as { _delegate: Firestore })._delegate, () => "other-admin");
  await writer.save("drivers", "cross-session", {
    id: "cross-session",
    name: "Live driver",
    active: true,
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Listener did not reflect archive")),
      10000,
    );
    const stop = reader.subscribe(
      "drivers",
      (rows) => {
        if (rows.some((r) => r.id === "cross-session" && r.active === false)) {
          clearTimeout(timer);
          stop();
          resolve();
        }
      },
      (state) => {
        if (state.error) {
          clearTimeout(timer);
          reject(new Error(state.error));
        }
      },
    );
    writer.save("drivers", "cross-session", { active: false }).catch(reject);
  });
  await writer.remove("drivers", "cross-session");
  const record = await getDoc(doc(admin(), "drivers", "cross-session"));
  if (record.exists()) throw new Error("Deletion was not persisted");
});
