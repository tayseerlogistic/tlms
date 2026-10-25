/** Dry-run by default. Uses ADC, never browser credentials or bundled service-account keys. */
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMigrationPlan } from "../src/utils/dataMigration";
const projectId = "sonic-hawk-hsmzh";
const databaseId = "ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9";
const app = initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore(app, databaseId);
const names = [
  "trucks",
  "drivers",
  "equipment",
  "km_records",
  "diesel_logs",
  "schedules",
  "manifests",
  "cashbook",
  "cash_accounts",
  "cash_employees",
  "commodities",
  "stores",
  "data_quality",
  "app_state",
];
const source: Record<string, any[]> = {};
const versions = new Map<string, FirebaseFirestore.Timestamp>();
for (const name of names) {
  const snap = await db.collection(name).get();
  source[name] = snap.docs.map((d) => {
    versions.set(`${name}/${d.id}`, d.updateTime!);
    return { ...d.data(), id: d.id };
  });
}
const args = process.argv.slice(2);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const numericMap = value("--driver-index-map");
const plan = buildMigrationPlan(
  source,
  numericMap ? JSON.parse(readFileSync(numericMap, "utf8")) : {},
);
const output = resolve(value("--output") || "migration-output");
mkdirSync(output, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(
  `${output}/backup-${stamp}.json`,
  JSON.stringify(
    { projectId, databaseId, exportedAt: stamp, collections: source },
    null,
    2,
  ),
);
writeFileSync(`${output}/plan-${stamp}.json`, JSON.stringify(plan, null, 2));
console.log(
  JSON.stringify(
    {
      projectId,
      databaseId,
      plannedWrites: plan.writes.length,
      blockers: plan.blockers,
      output,
    },
    null,
    2,
  ),
);
if (args.includes("--apply")) {
  if (plan.blockers.length)
    throw new Error(
      "Migration blocked. Resolve ambiguous mappings in Firestore or supply an explicit driver-index map, then rerun the dry-run.",
    );
  // Every write is conditional on the read version. A concurrent edit aborts instead of overwriting it.
  for (let start = 0; start < plan.writes.length; start += 200) {
    const batch = db.batch();
    for (const w of plan.writes.slice(start, start + 200)) {
      const ref = db.collection(w.collection).doc(w.id),
        version = versions.get(`${w.collection}/${w.id}`);
      if (version) batch.update(ref, w.data, { lastUpdateTime: version });
      else batch.create(ref, w.data);
    }
    await batch.commit();
  }
  for (const w of plan.writes) {
    const snap = await db.collection(w.collection).doc(w.id).get();
    if (!snap.exists)
      throw new Error(`Verification failed: ${w.collection}/${w.id}`);
    for (const [key, value] of Object.entries(w.data)) {
      if (JSON.stringify(snap.data()?.[key]) !== JSON.stringify(value))
        throw new Error(
          `Verification mismatch: ${w.collection}/${w.id}.${key}`,
        );
    }
  }
  console.log(
    `Verified ${plan.writes.length} migration writes. Legacy documents retained for audit; canonical projections deduplicate them.`,
  );
}
