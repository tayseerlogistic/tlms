import { reportMeterPlan, validateDriverReport, type DriverReport, type ReportDay } from '../utils/driverReports';
import { ksaDateISO, isValidISODate } from '../utils/dateUtils';
import {
  collection,
  doc,
  onSnapshot,
  getDocsFromServer,
  getDocFromServer,
  query,
  where,
  writeBatch,
  runTransaction,
  setDoc,
  deleteDoc,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import type { CashTransaction, KmRecord, Truck, TimetableRow } from "../types";
import { runVerifiedImport, type ImportResult } from "./verifiedImport";
export type { ImportResult } from "./verifiedImport";
import { canonicalKm } from "../utils/fleetAnalytics";

export type SyncState =
  "loading" | "synced" | "syncing" | "offline" | "guest/local-only" | "error";
export type RepositoryStatus = { state: SyncState; error?: string };
export type Write = {
  collection: string;
  id: string;
  data?: DocumentData;
  remove?: boolean;
  merge?: boolean;
};
const clean = (data: DocumentData) => JSON.parse(JSON.stringify(data));
export function requireSession() {
  if (!auth.currentUser)
    throw new Error(
      "Sign in with a Firebase account. Production data cannot be saved in guest mode.",
    );
  if (typeof navigator !== "undefined" && !navigator.onLine)
    throw new Error(
      "Offline: reconnect before saving. No local-only save was made.",
    );
  return auth.currentUser.uid;
}

export function createFleetRepository(
  database: Firestore,
  session: () => string = requireSession,
) {
  const db = database;
  const requireSession = session;
  return {
    subscribe(
      name: string,
      receive: (rows: DocumentData[]) => void,
      status: (value: RepositoryStatus) => void,
    ) {
      status({ state: "loading" });
      let serverConfirmed = false;
      return onSnapshot(
        collection(db, name),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (!snapshot.metadata.fromCache) serverConfirmed = true;
          receive(
            serverConfirmed
              ? snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))
              : [],
          );
          status({
            state: snapshot.metadata.hasPendingWrites
              ? "syncing"
              : snapshot.metadata.fromCache
                ? "offline"
                : "synced",
          });
        },
        (error) => {
          receive([]);
          status({ state: "error", error: `${name}: ${error.message}` });
        },
      );
    },
    async reviewDriverReport(id: string, approve: boolean) {
      const uid = requireSession();
      await runTransaction(db, async transaction => {
        const reportRef = doc(db,'driver_reports',id);
        const snapshot = await transaction.get(reportRef);
        if (!snapshot.exists()) throw new Error('Report no longer exists.');
        const report = {...snapshot.data(),id} as DriverReport;
        if (report.state !== 'review') throw new Error('This report has already been reviewed. Refresh the list.');
        const reviewedAt = new Date().toISOString();
        if (!approve) {
          transaction.update(reportRef,{state:'rejected',reviewedBy:uid,reviewedAt,updatedAt:reviewedAt});
          return;
        }
        validateDriverReport(report,ksaDateISO());
        if (!report.driverId) throw new Error('Assign the report to its historical driver before approving.');
        const truckRef = doc(db,'trucks',report.truckId);
        const truck = await transaction.get(truckRef);
        if (!truck.exists()) throw new Error('Truck is missing.');
        const key = report.truckId+'_'+report.date;
        const dayRef = doc(db,'driver_report_days',key);
        const day = await transaction.get(dayRef);
        const records = await getDocsFromServer(query(collection(db,'km_records'),where('truckId','==',report.truckId)));
        const meterDocs = await Promise.all(records.docs.map(row => transaction.get(row.ref)));
        const prior = day.exists() ? day.data() as ReportDay : undefined;
        const plan = reportMeterPlan(report,meterDocs.map(row=>({...row.data(),id:row.id} as KmRecord)),prior,true);
        const priorRef = prior && prior.reportId !== id ? doc(db,'driver_reports',prior.reportId) : null;
        if (priorRef) await transaction.get(priorRef);
        if (priorRef) transaction.update(priorRef,{state:'superseded',reviewedBy:uid,reviewedAt,updatedAt:reviewedAt});
        transaction.update(reportRef,{state:'accepted',reason:plan.reason,reviewedBy:uid,reviewedAt,updatedAt:reviewedAt});
        transaction.set(dayRef,clean({...report,state:'accepted',reportId:id,reason:plan.reason,reviewedBy:uid,reviewedAt,updatedAt:reviewedAt}));
        for (const record of plan.writes) transaction.set(doc(db,'km_records',record.id),clean({...record,updatedAt:reviewedAt}),{merge:true});
        transaction.update(truckRef,{reportRevision:Number(truck.data()?.reportRevision || 0)+1});
      });
    },
    async commitAssignments(writes: Write[], effectiveDate = ksaDateISO()) {
      const uid = requireSession();
      if (!isValidISODate(effectiveDate) || effectiveDate > ksaDateISO()) throw new Error('Assignment date must be today or earlier.');
      const proposedIds = new Map(writes.filter(w=>w.collection==='trucks' && w.data && 'assignedDriverId' in w.data).map(w=>[w.id,crypto.randomUUID()]));
      await runTransaction(db, async transaction => {
        const snapshots = await Promise.all(writes.map(w=>transaction.get(doc(db,w.collection,w.id))));
        const eventIds = new Map(proposedIds);
        writes.forEach((write,index) => {
          if (write.collection==='trucks' && (snapshots[index].data()?.assignedDriverId || null)===(write.data?.assignedDriverId || null)) eventIds.delete(write.id);
        });
        const fleet = eventIds.size ? await getDocsFromServer(collection(db,'trucks')) : null;
        const people = eventIds.size ? await getDocsFromServer(collection(db,'drivers')) : null;
        if (fleet && people) {
          const apply = (name: string, docs: typeof fleet.docs) => {
            const result = new Map(docs.map(item=>[item.id,{...item.data(),id:item.id} as DocumentData]));
            writes.filter(write=>write.collection===name).forEach(write=>result.set(write.id,{...result.get(write.id),...write.data,id:write.id}));
            return result;
          };
          const futureTrucks = apply('trucks',fleet.docs), futureDrivers = apply('drivers',people.docs);
          const changedDrivers = new Set(writes.filter(write=>write.collection==='drivers').map(write=>write.id));
          for (const truck of futureTrucks.values()) {
            if (!eventIds.has(truck.id) && !changedDrivers.has(truck.assignedDriverId)) continue;
            if (!truck.assignedDriverId) continue;
            const driver = futureDrivers.get(truck.assignedDriverId);
            if (!driver || driver.active===false || driver.assignedTruckId!==truck.id)
              throw new Error('Assignments changed while editing. Reopen the truck and driver before saving.');
          }
          for (const driver of futureDrivers.values()) {
            if (!changedDrivers.has(driver.id)) continue;
            if (driver.assignedTruckId && futureTrucks.get(driver.assignedTruckId)?.assignedDriverId!==driver.id)
              throw new Error('Assignments are inconsistent. Reassign using Driver Reports.');
          }
        }
        const currentDateEvents = eventIds.size ? await getDocsFromServer(query(collection(db,'assignment_events'),where('effectiveDate','>=',effectiveDate))) : null;
        if (currentDateEvents?.docs.some(event=>eventIds.has(event.data().truckId) && event.data().effectiveDate>effectiveDate))
          throw new Error('A later assignment exists. Review the assignment history before backdating.');
        writes.forEach((write,index) => {
          const snapshot = snapshots[index], before = snapshot.data(), ref = doc(db,write.collection,write.id);
          if (write.remove) transaction.delete(ref);
          else transaction.set(ref,clean({...write.data,updatedAt:new Date().toISOString()}),{merge:write.merge!==false});
          if (eventIds.has(write.id) && write.collection==='trucks' &&
              (before?.assignedDriverId || null)!==(write.data?.assignedDriverId || null)) {
            transaction.set(doc(db,'assignment_events',eventIds.get(write.id)!),clean({
              truckId:write.id,plate:write.data?.plate || before?.plate || '',
              driverId:write.data?.assignedDriverId || null,driverName:write.data?.assignedDriverName || '',
              previousDriverId:before?.assignedDriverId || null,previousDriverName:before?.assignedDriverName || '',
              effectiveDate,changedAt:new Date().toISOString(),changedBy:uid
            }));
          }
        });
      });
    },
    async assignTruck(truckId: string, driverId: string | null, date: string) {
      const trucks = await this.list('trucks') as Truck[];
      const drivers = await this.list('drivers') as unknown as import('../types').Driver[];
      const truck = trucks.find(row=>row.id===truckId && !row.archived);
      const driver = drivers.find(row=>row.id===driverId && row.active!==false);
      if (!truck || (driverId && !driver)) throw new Error('Choose an active truck and driver.');
      const writes: Write[] = [
        {collection:'trucks',id:truckId,data:{assignedDriverId:driverId,assignedDriverName:driver?.name || null}},
        ...drivers.filter(row=>row.assignedTruckId===truckId && row.id!==driverId).map(row=>({
          collection:'drivers',id:row.id,data:{assignedTruckId:null,assignedVehiclePlate:null}})),
        ...trucks.filter(row=>driverId && row.assignedDriverId===driverId && row.id!==truckId).map(row=>({
          collection:'trucks',id:row.id,data:{assignedDriverId:null,assignedDriverName:null}}))
      ];
      if (driver) writes.push({collection:'drivers',id:driver.id,data:{assignedTruckId:truckId,assignedVehiclePlate:truck.plate}});
      await this.commitAssignments(writes,date);
    },
    async changeScheduleRows(date: string, change: (rows: TimetableRow[]) => TimetableRow[], allowCreate = false) {
      const uid = requireSession();
      const ref = doc(db, 'schedules', date);
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists() && !allowCreate) throw new Error('This schedule was removed. Reopen the date.');
        const rows = change(snapshot.data()?.rows ?? []);
        transaction.set(ref, clean({ date, rows, confirmed: true, updatedBy: uid, updatedAt: new Date().toISOString() }), { merge: true });
      });
    },
    async saveSchedule(date: string, rows: TimetableRow[], draftTags?: Record<string, string>) {
      const uid = requireSession();
      const schedule = doc(db, "schedules", date);
      const data = clean({ date, rows, confirmed: true, updatedBy: uid, updatedAt: new Date().toISOString() });
      if (draftTags === undefined) {
        await setDoc(schedule, data, { merge: true });
        return;
      }
      const manifest = doc(db, "manifests", date);
      await runTransaction(db, async transaction => {
        const existing = await transaction.get(manifest);
        transaction.set(schedule, data, { merge: true });
        // A schedule can seed a new draft. Only follow-up actions may change existing statuses.
        if (!existing.exists()) {
          transaction.set(manifest, { date, scheduleId: date, tags: draftTags,
            confirmed: false, updatedAt: data.updatedAt, updatedBy: uid });
        }
      });
    },
    async list(name: string) {
      requireSession();
      const result = await getDocsFromServer(collection(db, name));
      return result.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async replaceCashbook(incoming: CashTransaction[], before: DocumentData[]) {
      const uid = requireSession();
      if (!incoming.length || new Set(incoming.map(row => row.id)).size !== incoming.length)
        throw new Error('Replacement must contain unique transactions.');
      const next = new Map(incoming.map(row => [row.id, row]));
      const old = new Map(before.map(row => [row.id, row]));
      const ids = Array.from(new Set([...next.keys(), ...old.keys()]));
      if (ids.length > 450) throw new Error('Replacement exceeds the safe atomic limit. No transactions were changed.');
      const stable = (value: any): any => Array.isArray(value) ? value.map(stable) :
        value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
      await runTransaction(db, async transaction => {
        if (requireSession() !== uid) throw new Error('Account changed. Preview again.');
        const snapshots = await Promise.all(ids.map(id => transaction.get(doc(db, 'cashbook', id))));
        snapshots.forEach((snapshot,index) => {
          const previous = old.get(ids[index]);
          const actual = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : undefined;
          if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(previous)))
            throw new Error('Transactions changed since preview. Nothing replaced; load the CSV again.');
        });
        ids.forEach(id => {
          const row = next.get(id);
          const ref = doc(db, 'cashbook', id);
          if (row) transaction.set(ref, clean({ ...row, createdBy: old.get(id)?.createdBy || uid,
            createdAt: old.get(id)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
            importSource: 'cashbook-csv-replacement' }));
          else transaction.delete(ref);
        });
      });
      const saved = await this.list('cashbook');
      if (saved.length !== incoming.length || saved.some(actual => {
        const expected = next.get(actual.id);
        return !expected || Object.entries(expected).some(([key,value]) => (actual as DocumentData)[key] !== value);
      })) throw new Error('Replacement committed, but final verification differs. Do not repeat blindly; check for concurrent entries.');
      return saved.length;
    },
    async save(name: string, id: string, data: DocumentData, merge = true) {
      requireSession();
      await setDoc(
        doc(db, name, id),
        clean({ ...data, updatedAt: new Date().toISOString() }),
        { merge },
      );
    },
    async remove(name: string, id: string) {
      requireSession();
      await deleteDoc(doc(db, name, id));
    },
    async commit(writes: Write[]) {
      const uid = requireSession();
      for (let offset = 0; offset < writes.length; offset += 200) {
        if (requireSession() !== uid)
          throw new Error(
            "Account changed during save. Review persisted records before retrying.",
          );
        const batch = writeBatch(db);
        writes.slice(offset, offset + 200).forEach((w) => {
          const ref = doc(db, w.collection, w.id);
          if (w.remove) batch.delete(ref);
          else
            batch.set(
              ref,
              clean({ ...w.data, updatedAt: new Date().toISOString() }),
              { merge: w.merge !== false },
            );
        });
        await batch.commit();
      }
    },
    async importKm(
      records: (Omit<KmRecord, "id"> | KmRecord)[],
      trucks: Truck[],
    ): Promise<ImportResult> {
      const uid = requireSession();
      if (!records.length) throw new Error("No valid KM records to save.");
      // Validate the complete input before making any changes. IDs make retries idempotent.
      const prepared = new Map<string, KmRecord>();
      records.forEach((r) => {
        const row = canonicalKm(r, trucks);
        const prev = prepared.get(row.id);
        if (prev && (prev.km !== row.km || prev.odometer !== row.odometer))
          throw new Error(`Conflicting duplicate KM row: ${row.id}`);
        prepared.set(row.id, row);
      });
      const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify(
            [...prepared.values()].sort((a, b) => a.id.localeCompare(b.id)),
          ),
        ),
      );
      const fileHash = Array.from(new Uint8Array(hashBytes), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const batchId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const batchRef = doc(db, "import_batches", batchId);
      return runVerifiedImport(batchId, [...prepared.values()], {
        begin: (result) =>
          setDoc(batchRef, {
            ...result,
            type: "km",
            fileHash,
            startedAt,
            createdBy: uid,
            status: "running",
          }),
        write: async (records) => {
          if (requireSession() !== uid)
            throw new Error("Account changed during import.");
          await this.commit(
            records.map((r) => ({
              collection: "km_records",
              id: r.id,
              data: {
                ...r,
                source: r.source || "import",
                importBatchId: batchId,
                createdBy: r.createdBy || uid,
                createdAt: r.createdAt || startedAt,
                loggedBy: uid,
              },
            })),
          );
        },
        verify: async () => {
          if (requireSession() !== uid)
            throw new Error("Account changed during import verification.");
          const verified = await getDocsFromServer(
            query(
              collection(db, "km_records"),
              where("importBatchId", "==", batchId),
            ),
          );
          return verified.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as KmRecord,
          );
        },
        finish: (result, writeErrors) =>
          setDoc(
            batchRef,
            { ...result, completedAt: new Date().toISOString(), writeErrors },
            { merge: true },
          ),
        verificationFailed: (message) =>
          setDoc(
            batchRef,
            { status: "verification-failed", verificationError: message },
            { merge: true },
          ),
      });
    },
    async updateKmFields(
      base: KmRecord,
      patch: {
        distanceKm?: number;
        odometerKm?: number | null;
        source?: string;
      },
      trucks: Truck[],
    ) {
      const uid = requireSession();
      const canonical = canonicalKm(base, trucks);
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "km_records", canonical.id);
        const snapshot = await transaction.get(ref);
        const current = snapshot.exists()
          ? (snapshot.data() as KmRecord)
          : canonical;
        const next = canonicalKm({ ...current, ...patch }, trucks);
        transaction.set(
          ref,
          clean({
            ...next,
            createdBy: current.createdBy || uid,
            createdAt: current.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            loggedBy: uid,
          }),
        );
      });
    },
    async saveKm(record: Omit<KmRecord, "id"> | KmRecord, trucks: Truck[]) {
      const uid = requireSession();
      const row = canonicalKm(record, trucks);
      const existing = await getDocFromServer(doc(db, "km_records", row.id));
      await this.save("km_records", row.id, {
        ...row,
        createdAt: existing.data()?.createdAt || new Date().toISOString(),
        createdBy: existing.data()?.createdBy || uid,
        loggedBy: uid,
      });
    },
  };
}
export const fleetRepository = createFleetRepository(db, requireSession);
