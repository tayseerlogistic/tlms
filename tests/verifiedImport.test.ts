import test from "node:test";
import assert from "node:assert/strict";
import {
  runVerifiedImport,
  type ImportTransport,
} from "../src/services/verifiedImport";
import type { KmRecord } from "../src/types";
const rows: KmRecord[] = Array.from({ length: 451 }, (_, i) => ({
  id: `t-${i}`,
  truckId: i < 300 ? "truck-a" : "truck-b",
  date: "2026-03-01",
  veh: "A",
  km: i,
  distanceKm: i,
  odometer: null,
  odometerKm: null,
}));
function harness(
  options: {
    failBatch?: number;
    verifyFail?: boolean;
    alter?: boolean;
    beginFail?: boolean;
  } = {},
) {
  const saved = new Map<string, KmRecord>();
  const calls: KmRecord[][] = [];
  let started = false,
    finished: any,
    verificationError = "";
  const port: ImportTransport = {
    begin: async () => {
      if (options.beginFail) throw new Error("permission-denied");
      started = true;
    },
    write: async (batch) => {
      assert.ok(started);
      calls.push(batch);
      if (options.failBatch === calls.length)
        throw new Error("permission-denied");
      batch.forEach((r) => saved.set(r.id, r));
    },
    verify: async () => {
      if (options.verifyFail) throw new Error("unavailable");
      return [...saved.values()].map((r, i) =>
        options.alter && i === 0 ? { ...r, distanceKm: -1 } : r,
      );
    },
    finish: async (result) => {
      finished = result;
    },
    verificationFailed: async (msg) => {
      verificationError = msg;
    },
  };
  return {
    port,
    calls,
    saved,
    get finished() {
      return finished;
    },
    get verificationError() {
      return verificationError;
    },
  };
}
test("large import batches stay below limits and use only one truck per batch", async () => {
  const h = harness();
  const r = await runVerifiedImport("batch", rows, h.port);
  assert.equal(r.persistedRecordCount, 451);
  assert.equal(r.status, "completed");
  assert.equal(h.calls.length, 3);
  for (const batch of h.calls) {
    assert.ok(batch.length <= 200);
    assert.equal(new Set(batch.map((r) => r.truckId)).size, 1);
  }
});
test("partial batch failure is counted from server data and retains retry IDs", async () => {
  const h = harness({ failBatch: 2 });
  const r = await runVerifiedImport("partial", rows, h.port);
  assert.equal(r.status, "partial");
  assert.equal(r.persistedRecordCount, 351);
  assert.equal(r.failedRecordCount, 100);
  assert.equal(r.failedIds.length, 100);
});
test("server verification failure never produces a successful result", async () => {
  const h = harness({ verifyFail: true });
  await assert.rejects(
    runVerifiedImport("offline", rows, h.port),
    /could not be verified/,
  );
  assert.equal(h.finished, undefined);
  assert.ok(h.verificationError.includes("unavailable"));
});
test("write acknowledgement with mismatched server data is partial", async () => {
  const h = harness({ alter: true });
  const r = await runVerifiedImport("wrong", rows, h.port);
  assert.equal(r.failedRecordCount, 1);
  assert.equal(r.status, "partial");
});
test("failure to create the import ledger stops every business write", async () => {
  const h = harness({ beginFail: true });
  await assert.rejects(
    runVerifiedImport("blocked", rows, h.port),
    /permission-denied/,
  );
  assert.equal(h.calls.length, 0);
});
test("retrying identical canonical IDs cannot create extra records", async () => {
  const h = harness();
  await runVerifiedImport("first", rows, h.port);
  await runVerifiedImport("retry", rows, h.port);
  assert.equal(h.saved.size, rows.length);
});
