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
import type { KmRecord, Truck } from "../types";
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
    async list(name: string) {
      requireSession();
      const result = await getDocsFromServer(collection(db, name));
      return result.docs.map((d) => ({ ...d.data(), id: d.id }));
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
