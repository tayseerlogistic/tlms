import { readFileSync } from "node:fs";
import test from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, type Firestore } from "firebase/firestore";

test("schedule reimports preserve confirmed statuses, legacy confirmations and existing drafts", async t => {
  const { createFleetRepository } = await import("../../src/services/fleetRepository");
  const env = await initializeTestEnvironment({ projectId: "demo-manifest-history",
    firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  t.after(() => env.cleanup());
  await env.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), "users", "test-user"), { role: "dispatcher" }));
  const db = env.authenticatedContext("test-user").firestore();
  const repo = createFleetRepository((db as unknown as { _delegate: Firestore })._delegate, () => "test-user");
  const date = "2026-11-10";
  const ref = doc(db, "manifests", date);
  await repo.saveSchedule(date, [], { d1: "Loading" });
  if ((await getDoc(ref)).data()?.confirmed !== false) throw new Error("Missing initial draft");
  for (const flags of [{ confirmed: true }, {}, { confirmed: false, confirmedBy: "operator" }]) {
    await setDoc(ref, { date, tags: { d1: "Reached customer" }, ...flags });
    await repo.saveSchedule(date, [], { d1: "Loading" });
    const saved = (await getDoc(ref)).data();
    if (saved?.tags.d1 !== "Reached customer" || saved.confirmed !== ('confirmed' in flags ? flags.confirmed : undefined))
      throw new Error("Schedule changed the saved manifest");
  }
});

test('single-trip changes keep concurrent additions and preserve the date after the last deletion', async t => {
  const {createFleetRepository} = await import('../../src/services/fleetRepository');
  const env = await initializeTestEnvironment({projectId:'demo-trip-changes',firestore:{rules:readFileSync('firestore.rules','utf8')}});
  t.after(()=>env.cleanup());
  const db = env.authenticatedContext('admin',{email:'admin@tls.com'}).firestore();
  const repo = createFleetRepository((db as unknown as {_delegate:Firestore})._delegate,()=>'admin');
  const date = '2026-11-12';
  const add = (id:string) => repo.changeScheduleRows(date, rows => [...rows,{id} as typeof rows[number]],true);
  await Promise.all([add('trip-a'),add('trip-b')]);
  const ref = doc(db,'schedules',date);
  const remove = (id:string) => repo.changeScheduleRows(date,rows=>rows.filter(row=>row.id!==id));
  await remove('trip-a');
  const remaining = (await getDoc(ref)).data()?.rows;
  if (remaining.length!==1 || remaining[0].id!=='trip-b') throw Error('Wrong trip removed');
  await remove('trip-b');
  if ((await getDoc(ref)).data()?.rows.length!==0) throw Error('Empty schedule lost');
});
