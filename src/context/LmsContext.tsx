import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  fleetRepository,
  requireSession,
  type RepositoryStatus,
  type SyncState,
  type Write,
  type ImportResult,
} from "../services/fleetRepository";
import {
  normalizePlate,
  normalizeName,
  resolveTruck,
  resolveDriver,
  projectKm,
  canonicalKm,
} from "../utils/fleetAnalytics";
import { latestRecordedKmMonth } from "../utils/kmImportUtils";
import { ksaDateISO } from "../utils/dateUtils";
import type { TimetableDatabase } from "../utils/timetableEngine";
import type {
  Truck,
  Equipment,
  Driver,
  Commodity,
  StoreMapItem,
  DailySchedule,
  CashTransaction,
  CashAccount,
  KmRecord,
  DieselLog,
  DataConflict,
  LearnedRule,
  TimetableRow,
} from "../types";
interface LmsContextType {
  updateDailyKm: (truckId: string, date: string, km: number) => Promise<void>;
  updateOdometer: (
    truckId: string,
    date: string,
    meter: number | null,
  ) => Promise<void>;
  syncStatus: SyncState;
  errorStates: Record<string, string>;
  loadingStates: Record<string, boolean>;
  dataSourceStatus: string;
  selectedKmMonth: string;
  setSelectedKmMonth: React.Dispatch<React.SetStateAction<string>>;
  branding: Record<string, any>;
  saveBranding: (data: Record<string, unknown>) => Promise<void>;
  saveTimetableRegistry: (
    next: TimetableDatabase,
    previous: TimetableDatabase,
  ) => Promise<void>;
  trucks: Truck[];
  historicalTrucks: Truck[];
  equipment: Equipment[];
  drivers: Driver[];
  commodities: Commodity[];
  stores: StoreMapItem[];
  schedules: Record<string, DailySchedule>;
  manifests: Record<string, Record<string, string>>; // date -> { driverIndex/name -> tag }
  cashTransactions: CashTransaction[];
  cashAccounts: CashAccount[];
  cashEmployees: { id: string; name: string }[];
  kmRecords: KmRecord[];
  dieselLogs: DieselLog[];
  conflicts: DataConflict[];
  learnedRules: LearnedRule[];

  // Actions
  saveTruck: (truck: Truck) => Promise<void>;
  deleteTruck: (id: string) => Promise<void>;
  saveEquipment: (equip: Equipment) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  saveDriver: (driver: Driver) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;

  saveDailySchedule: (
    date: string,
    rows: any[],
    syncToManifest?: boolean,
  ) => Promise<void>;
  deleteDailySchedule: (date: string) => Promise<void>;
  saveDailyManifest: (
    date: string,
    tags: Record<string, string>,
  ) => Promise<void>;
  saveMultiDayManifests: (
    batchData: Record<string, Record<string, string>>,
  ) => Promise<void>;

  addCashTransaction: (
    tx: Omit<CashTransaction, "id" | "createdAt">,
  ) => Promise<void>;
  addCashAccount: (account: Omit<CashAccount, "id">) => Promise<void>;
  deleteCashAccount: (id: string) => Promise<void>;
  addCashEmployee: (name: string) => Promise<void>;
  deleteCashEmployee: (id: string) => Promise<void>;
  reverseCashTransaction: (id: string, reason: string) => Promise<void>;
  deleteCashTransaction: (id: string) => Promise<void>;

  addKmRecord: (rec: Omit<KmRecord, "id">) => Promise<void>;
  batchSaveKmRecords: (
    records: (Omit<KmRecord, "id"> | KmRecord)[],
  ) => Promise<ImportResult>;
  deleteKmRecord: (id: string) => Promise<void>;
  addDieselLog: (log: Omit<DieselLog, "id">) => Promise<void>;

  resolveConflict: (conflictId: string, note?: string) => Promise<void>;
  restoreFullBackup: (
    jsonContent: any,
  ) => Promise<{ success: boolean; message: string }>;
  exportFullBackup: () => void;
  learnHistoricalRules: (rules: LearnedRule[]) => Promise<void>;
}

const LmsContext = createContext<LmsContextType | undefined>(undefined);
const EMPTY_ROWS: Record<string, any[]> = {};
const collections = [
  "trucks",
  "equipment",
  "drivers",
  "commodities",
  "stores",
  "schedules",
  "manifests",
  "cashbook",
  "cash_accounts",
  "cash_employees",
  "km_records",
  "diesel_logs",
  "data_quality",
  "app_state",
] as const;
type Rows = Record<string, any[]>;
export const LmsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  const [remote, setRemote] = useState<Rows>({});
  const [statuses, setStatuses] = useState<Record<string, RepositoryStatus>>(
    {},
  );
  const [writeError, setWriteError] = useState("");
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedKmMonth, setSelectedKmMonth] = useState(
    () =>
      localStorage.getItem("tlms.km.selectedMonth") || ksaDateISO().slice(0, 7),
  );
  useEffect(() => {
    localStorage.setItem("tlms.km.selectedMonth", selectedKmMonth);
  }, [selectedKmMonth]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setRemote({});
    setStatuses({});
    setWriteError("");
    setSessionId(user?.uid || null);
    if (!user) return;
    const subscriptions = collections.map((name) =>
      fleetRepository.subscribe(
        name,
        (rows) => {
          if (active) setRemote((prev) => ({ ...prev, [name]: rows }));
        },
        (status) => {
          if (active) setStatuses((prev) => ({ ...prev, [name]: status }));
        },
      ),
    );
    return () => {
      active = false;
      subscriptions.forEach((stop) => stop());
    };
  }, [user?.uid]);
  // Never render a previous account's records while the new subscriptions hydrate.
  const rows = sessionId === user?.uid ? remote : EMPTY_ROWS;
  const {
    allTrucks,
    trucks,
    equipment,
    rawDrivers,
    commodities,
    stores,
    manifests,
    drivers,
    schedules,
    cashTransactions,
    cashAccounts,
    cashEmployees,
    kmRecords,
    dieselLogs,
    conflicts,
    learnedRules,
    branding,
  } = useMemo(() => {
    const sorted = <T extends { seq?: number }>(items: T[]) =>
      [...items].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    const allTrucks = sorted<Truck>(rows.trucks || []).map((t) => ({
      ...t,
      plateNorm: normalizePlate(t.plate),
      normalizedPlate: normalizePlate(t.plate),
    }));
    const trucks = allTrucks.filter((t) => !t.archived);
    const equipment = sorted<Equipment>(rows.equipment || []);
    const rawDrivers = sorted<Driver>(rows.drivers || []);
    const commodities: Commodity[] = rows.commodities || [];
    const stores: StoreMapItem[] = rows.stores || [];
    const manifests: Record<
      string,
      Record<string, string>
    > = Object.fromEntries(
      (rows.manifests || []).map((m) => [m.date || m.id, m.tags || {}]),
    );
    // History is a projection of canonical manifests, never a second persisted copy.
    const drivers = rawDrivers.map((d) => ({
      ...d,
      history: Object.fromEntries(
        Object.entries(manifests)
          .filter(([, tags]) => tags[d.id] !== undefined)
          .map(([date, tags]) => [date, tags[d.id]]),
      ),
    }));
    const schedules: Record<string, DailySchedule> = Object.fromEntries(
      (rows.schedules || []).map((s) => [
        s.date || s.id,
        {
          ...s,
          rows: (s.rows || []).map((r: TimetableRow) => {
            const d = resolveDriver(
              rawDrivers,
              r.driverId,
              r.driverName,
              r.iqama,
            );
            const t = resolveTruck(allTrucks, r.truckId, r.plateNo);
            const current = (s.date || s.id) >= ksaDateISO();
            return {
              ...r,
              driverId: d?.id || r.driverId || null,
              truckId: t?.id || r.truckId || null,
              ...(current && d?.active === false
                ? { driverId: null, driverName: "", iqama: "", mobile: "" }
                : current && d
                  ? { driverName: d.name, iqama: d.iqama, mobile: d.mobile }
                  : {}),
              ...(current && t?.archived
                ? { truckId: null, plateNo: "" }
                : current && t
                  ? { plateNo: t.plate }
                  : {}),
            };
          }),
        },
      ]),
    );
    const cashTransactions: CashTransaction[] = [...(rows.cashbook || [])].sort(
      (a, b) => String(b.dateISO || b.date).localeCompare(a.dateISO || a.date),
    );
    const cashAccounts: CashAccount[] = rows.cash_accounts || [];
    const cashEmployees: { id: string; name: string }[] =
      rows.cash_employees || [];
    const kmRecords = projectKm(rows.km_records || [], allTrucks);
    const dieselLogs: DieselLog[] = (rows.diesel_logs || []).map((r) => {
      const t = resolveTruck(allTrucks, r.truckId, r.veh);
      return { ...r, truckId: t?.id || r.truckId, veh: t?.plate || r.veh };
    });
    const conflicts: DataConflict[] = rows.data_quality || [];
    const learnedRules: LearnedRule[] =
      (rows.app_state || []).find((s) => s.id === "learnedRules")?.rules || [];
    const branding =
      (rows.app_state || []).find((s) => s.id === "branding") || {};
    return {
      allTrucks,
      trucks,
      equipment,
      rawDrivers,
      commodities,
      stores,
      manifests,
      drivers,
      schedules,
      cashTransactions,
      cashAccounts,
      cashEmployees,
      kmRecords,
      dieselLogs,
      conflicts,
      learnedRules,
      branding,
    };
  }, [rows]);
  useEffect(() => {
    const latest = latestRecordedKmMonth(kmRecords);
    if (
      latest &&
      selectedKmMonth !== "All" &&
      !kmRecords.some((r) => r.date.startsWith(selectedKmMonth))
    )
      setSelectedKmMonth(latest);
  }, [kmRecords]);
  const errorStates = Object.fromEntries(
    Object.entries(statuses)
      .filter(([, s]) => s.error)
      .map(([name, s]) => [name, s.error!]),
  );
  if (writeError) errorStates.write = writeError;
  const loadingStates = Object.fromEntries(
    collections.map((name) => [
      name,
      !statuses[name] || statuses[name].state === "loading",
    ]),
  );
  const syncStatus: SyncState = !user
    ? "guest/local-only"
    : Object.keys(errorStates).length
      ? "error"
      : !online
        ? "offline"
        : pending
          ? "syncing"
          : Object.values(loadingStates).some(Boolean)
            ? "loading"
            : Object.values(statuses).some((s) => s.state === "syncing")
              ? "syncing"
              : Object.values(statuses).some((s) => s.state === "offline")
                ? "offline"
                : "synced";
  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    setWriteError("");
    setPending((p) => p + 1);
    try {
      requireSession();
      return await action();
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setPending((p) => Math.max(0, p - 1));
    }
  };
  const newId = () => crypto.randomUUID();
  const saveTruck = (truck: Truck) =>
    run(async () => {
      const d = truck.assignedDriverId
        ? drivers.find(
            (d) => d.id === truck.assignedDriverId && d.active !== false,
          )
        : undefined;
      if (truck.assignedDriverId && !d)
        throw new Error("Assigned driver is missing or archived.");
      const writes: Write[] = [
        {
          collection: "trucks",
          id: truck.id,
          data: {
            ...truck,
            plateNorm: normalizePlate(truck.plate),
            normalizedPlate: normalizePlate(truck.plate),
            assignedDriverName: d?.name || null,
            createdAt: truck.createdAt || new Date().toISOString(),
          },
        },
      ];
      drivers
        .filter((x) => x.assignedTruckId === truck.id && x.id !== d?.id)
        .forEach((x) =>
          writes.push({
            collection: "drivers",
            id: x.id,
            data: { assignedTruckId: null, assignedVehiclePlate: null },
          }),
        );
      trucks
        .filter((x) => x.assignedDriverId === d?.id && d && x.id !== truck.id)
        .forEach((x) =>
          writes.push({
            collection: "trucks",
            id: x.id,
            data: { assignedDriverId: null, assignedDriverName: null },
          }),
        );
      if (d)
        writes.push({
          collection: "drivers",
          id: d.id,
          data: {
            assignedTruckId: truck.id,
            assignedVehiclePlate: truck.plate,
          },
        });
      await fleetRepository.commit(writes);
    });
  const deleteTruck = (id: string) =>
    run(async () => {
      await fleetRepository.commit([
        {
          collection: "trucks",
          id,
          data: {
            archived: true,
            status: "OUT_OF_SERVICE",
            assignedDriverId: null,
            assignedDriverName: null,
          },
        },
        ...drivers
          .filter((d) => d.assignedTruckId === id)
          .map((d) => ({
            collection: "drivers",
            id: d.id,
            data: { assignedTruckId: null, assignedVehiclePlate: null },
          })),
        ...equipment
          .filter((e) => e.assignedTruckId === id)
          .map((e) => ({
            collection: "equipment",
            id: e.id,
            data: { assignedTruckId: null, assignedTruckPlate: null },
          })),
      ]);
    });
  const saveEquipment = (e: Equipment) =>
    run(() => fleetRepository.save("equipment", e.id, e));
  const deleteEquipment = (id: string) =>
    run(() =>
      fleetRepository.commit([
        {
          collection: "equipment",
          id,
          data: {
            active: false,
            assignedTruckId: null,
            assignedTruckPlate: null,
          },
        },
        ...trucks
          .filter((t) => t.assignedEquipmentId === id)
          .map((t) => ({
            collection: "trucks",
            id: t.id,
            data: { assignedEquipmentId: null },
          })),
      ]),
    );
  const saveDriver = (driver: Driver) =>
    run(async () => {
      const { history, ...data } = driver;
      const t = driver.assignedTruckId
        ? trucks.find((t) => t.id === driver.assignedTruckId)
        : undefined;
      if (driver.assignedTruckId && !t)
        throw new Error("Assigned truck is missing or archived.");
      const writes: Write[] = [
        {
          collection: "drivers",
          id: driver.id,
          data: {
            ...data,
            assignedVehiclePlate: t?.plate || null,
            createdAt: driver.createdAt || new Date().toISOString(),
          },
          merge: false,
        },
      ];
      trucks
        .filter((x) => x.assignedDriverId === driver.id && x.id !== t?.id)
        .forEach((x) =>
          writes.push({
            collection: "trucks",
            id: x.id,
            data: { assignedDriverId: null, assignedDriverName: null },
          }),
        );
      drivers
        .filter((x) => t && x.assignedTruckId === t.id && x.id !== driver.id)
        .forEach((x) =>
          writes.push({
            collection: "drivers",
            id: x.id,
            data: { assignedTruckId: null, assignedVehiclePlate: null },
          }),
        );
      if (t)
        writes.push({
          collection: "trucks",
          id: t.id,
          data: {
            assignedDriverId: driver.id,
            assignedDriverName: driver.name,
          },
        });
      await fleetRepository.commit(writes);
    });
  const deleteDriver = (id: string) =>
    run(async () => {
      // Fetch current assignments, so archive does not depend on stale screen state.
      const serverTrucks = (await fleetRepository.list("trucks")) as Truck[];
      await fleetRepository.commit([
        {
          collection: "drivers",
          id,
          data: {
            active: false,
            archivedAt: new Date().toISOString(),
            assignedTruckId: null,
            assignedVehiclePlate: null,
          },
        },
        ...serverTrucks
          .filter((t) => t.assignedDriverId === id)
          .map((t) => ({
            collection: "trucks",
            id: t.id,
            data: { assignedDriverId: null, assignedDriverName: null },
          })),
      ]);
      // Historical references remain stable. Operational projections exclude archived assignments.
    });
  const normalizeTags = (tags: Record<string, string>) => {
    if (
      Object.keys(tags).some(
        (k) => /^\d+$/.test(k) && !drivers.some((d) => d.id === k),
      )
    )
      throw new Error(
        "Legacy numeric manifest keys require an explicit driver-ID migration; current array order is not a safe identity.",
      );
    return tags;
  };
  const saveDailySchedule = (
    date: string,
    input: TimetableRow[],
    syncToManifest = true,
  ) =>
    run(async () => {
      const linked = input.map((row) => {
        const d = resolveDriver(
          drivers,
          row.driverId,
          row.driverName,
          row.iqama,
        );
        const t = resolveTruck(trucks, row.truckId, row.plateNo);
        if ((row.driverId && !d) || d?.active === false)
          throw new Error(`Driver is missing or archived: ${row.driverName}`);
        if (row.plateNo && !t)
          throw new Error(
            `Unmatched truck: ${row.plateNo}. Add it to Master Data first.`,
          );
        if (row.driverName && !d)
          throw new Error(
            `Unmatched driver: ${row.driverName}. Add it to Master Data first.`,
          );
        return { ...row, driverId: d?.id || null, truckId: t?.id || null };
      });
      const tags: Record<string, string> = {};
      if (syncToManifest)
        linked.forEach((r) => {
          if (r.driverId)
            tags[r.driverId] =
              `${r.commodity || ""} Supply for ${r.customer || r.supplier || r.store || "Customer"} - Under Loading at ${r.source || "Yanbu"}`.trim();
        });
      const writes: Write[] = [
        {
          collection: "schedules",
          id: date,
          data: { date, rows: linked, confirmed: true, updatedBy: user!.uid },
        },
      ];
      if (syncToManifest)
        writes.push({
          collection: "manifests",
          id: date,
          data: { date, scheduleId: date, tags, confirmedBy: user!.uid },
        });
      await fleetRepository.commit(writes);
    });
  const deleteDailySchedule = (date: string) =>
    run(() => fleetRepository.remove("schedules", date));
  const saveDailyManifest = (date: string, tags: Record<string, string>) =>
    run(() =>
      fleetRepository.save("manifests", date, {
        date,
        tags: normalizeTags(tags),
        confirmedBy: user!.uid,
      }),
    );
  const saveMultiDayManifests = (
    data: Record<string, Record<string, string>>,
  ) =>
    run(() =>
      fleetRepository.commit(
        Object.entries(data).map(([date, tags]) => ({
          collection: "manifests",
          id: date,
          data: { date, tags: normalizeTags(tags) },
        })),
      ),
    );
  const addCashTransaction = (tx: Omit<CashTransaction, "id" | "createdAt">) =>
    run(async () => {
      const account = cashAccounts.find(
        (a) =>
          a.id === tx.accountId || a.id === tx.account || a.name === tx.account,
      );
      if (!account) throw new Error("Select a saved Cashbook account.");
      const id = newId();
      await fleetRepository.save("cashbook", id, {
        ...tx,
        id,
        accountId: account.id,
        createdAt: new Date().toISOString(),
        createdBy: user!.uid,
      });
    });
  const addCashAccount = (a: Omit<CashAccount, "id">) =>
    run(async () => {
      const id = newId();
      await fleetRepository.save("cash_accounts", id, { ...a, id });
    });
  const deleteCashAccount = (id: string) =>
    run(async () => {
      if (
        cashTransactions.some(
          (t) =>
            t.accountId === id ||
            t.account === id ||
            t.account === cashAccounts.find((a) => a.id === id)?.name,
        )
      )
        throw new Error(
          "Account has transactions and must be retained for historical reports.",
        );
      await fleetRepository.remove("cash_accounts", id);
    });
  const addCashEmployee = (name: string) =>
    run(async () => {
      if (!name.trim()) throw new Error("Employee name is required.");
      await fleetRepository.save("cash_employees", newId(), {
        name: name.trim(),
      });
    });
  const deleteCashEmployee = (id: string) =>
    run(() => fleetRepository.remove("cash_employees", id));
  const reverseCashTransaction = (id: string, reason: string) =>
    run(async () => {
      const tx = cashTransactions.find((t) => t.id === id);
      if (
        !tx ||
        tx.status === "Reversed" ||
        tx.type === "Reversal" ||
        !reason.trim()
      )
        throw new Error(
          "Select an unreversed transaction and provide a correction reason.",
        );
      const reversalId = `REV-${id}`;
      await fleetRepository.commit([
        {
          collection: "cashbook",
          id: reversalId,
          data: {
            ...tx,
            id: reversalId,
            date: ksaDateISO(),
            dateISO: ksaDateISO(),
            type: "Reversal",
            status: "Posted",
            reversalOf: id,
            reversedType: tx.type,
            description: reason,
            createdAt: new Date().toISOString(),
            createdBy: user!.uid,
          },
        },
        { collection: "cashbook", id, data: { status: "Reversed" } },
      ]);
    });
  const deleteCashTransaction = async (_id: string) => {
    throw new Error("Use reversal to preserve the Cashbook audit trail.");
  };
  const updateKmFields = (
    truckId: string,
    date: string,
    patch: { distanceKm?: number; odometerKm?: number | null; source?: string },
  ) =>
    run(async () => {
      const truck = trucks.find((t) => t.id === truckId);
      if (!truck) throw new Error("Select an active truck.");
      const existing = kmRecords.find(
        (r) => r.truckId === truckId && r.date === date,
      );
      const base = existing || {
        id: `${truckId}_${date}`,
        truckId,
        date,
        veh: truck.plate,
        km: 0,
        odometer: null,
        source: "meter",
      };
      await fleetRepository.updateKmFields(base, patch, trucks);
    });
  const updateDailyKm = (truckId: string, date: string, km: number) =>
    updateKmFields(truckId, date, {
      distanceKm: km,
      source: "manual-distance",
    });
  const updateOdometer = (
    truckId: string,
    date: string,
    meter: number | null,
  ) => updateKmFields(truckId, date, { odometerKm: meter });
  const addKmRecord = (rec: Omit<KmRecord, "id">) =>
    run(() => fleetRepository.saveKm(rec, trucks));
  const batchSaveKmRecords = (records: (Omit<KmRecord, "id"> | KmRecord)[]) =>
    run(async () => {
      const result = await fleetRepository.importKm(records, trucks);
      if (result.status !== "completed")
        throw new Error(
          `Partial import: ${result.persistedRecordCount} of ${result.expectedRecordCount} KM records saved to Firestore. Retry the same file. Failed IDs are recorded in import batch ${result.batchId}.`,
        );
      return result;
    });
  const deleteKmRecord = (id: string) =>
    run(async () => {
      const row = kmRecords.find((r) => r.id === id);
      if (!row) return;
      const related = (rows.km_records || []).filter(
        (r) =>
          r.date === row.date &&
          resolveTruck(allTrucks, r.truckId, r.veh)?.id === row.truckId,
      );
      await fleetRepository.commit(
        related.map((r) => ({
          collection: "km_records",
          id: r.id,
          remove: true,
        })),
      );
    });
  const addDieselLog = (log: Omit<DieselLog, "id">) =>
    run(async () => {
      const truck = resolveTruck(trucks, log.truckId, log.veh);
      if (!truck) throw new Error(`Unmatched truck: ${log.veh}`);
      const driver = resolveDriver(
        drivers,
        log.driverId || truck.assignedDriverId,
        log.drv,
      );
      if (driver?.active === false)
        throw new Error(
          "Cannot assign an archived driver to a new diesel log.",
        );
      if (!Number.isFinite(log.liters) || log.liters <= 0)
        throw new Error("Liters must be positive.");
      const id = newId();
      await fleetRepository.save("diesel_logs", id, {
        ...log,
        id,
        truckId: truck.id,
        driverId: driver?.id || null,
        createdBy: user!.uid,
        createdAt: new Date().toISOString(),
      });
    });
  const resolveConflict = (id: string, note?: string) =>
    run(() =>
      fleetRepository.save("data_quality", id, {
        status: "resolved",
        resolution: note || "",
      }),
    );
  const learnHistoricalRules = (rules: LearnedRule[]) =>
    run(() =>
      fleetRepository.save("app_state", "learnedRules", {
        rules: rules.map((r) => ({
          ...r,
          driverId: r.driverId || drivers[r.driverIndex]?.id || null,
        })),
      }),
    );
  const saveBranding = (data: Record<string, unknown>) =>
    run(() => fleetRepository.save("app_state", "branding", data));
  const saveTimetableRegistry = (
    next: TimetableDatabase,
    previous: TimetableDatabase,
  ) =>
    run(async () => {
      // Diff the UI draft against its loaded version; never upload a parallel registry.
      const writes: Write[] = [];
      next.drivers
        .filter(
          (d) =>
            JSON.stringify(d) !==
            JSON.stringify(previous.drivers.find((p) => p.id === d.id)),
        )
        .forEach((d) => {
          const old = drivers.find((x) => x.id === d.id);
          writes.push({
            collection: "drivers",
            id: d.id,
            data: {
              ...(old
                ? {}
                : {
                    seq: 0,
                    empNo: "",
                    nationality: "",
                    transporter: "",
                    workingFor: "",
                    status: "AVAILABLE",
                    active: true,
                  }),
              ...d,
              nameNorm: normalizeName(d.name),
            },
          });
        });
      for (const d of previous.drivers.filter(
        (d) => !next.drivers.some((n) => n.id === d.id),
      ))
        await deleteDriver(d.id);
      next.vehicles
        .filter(
          (v) =>
            JSON.stringify(v) !==
            JSON.stringify(previous.vehicles.find((p) => p.id === v.id)),
        )
        .forEach((v) => {
          const existingEquipment = equipment.find((e) => e.id === v.id);
          if (existingEquipment) {
            const t = resolveTruck(trucks, v.truckId, v.plateNo);
            if (v.plateNo && !t)
              throw new Error(
                `Register truck ${v.plateNo} in Master Data before assigning equipment.`,
              );
            const driver = drivers.find(
              (d) => d.id === v.defaultDriverId && d.active !== false,
            );
            writes.push({
              collection: "equipment",
              id: v.id,
              data: {
                equipNo: v.equipmentNo,
                equipNorm: v.equipmentNo.replace(/\s+/g, ""),
                type: v.type,
                assignedTruckId: t?.id || null,
                assignedTruckPlate: t?.plate || null,
              },
            });
            if (t) {
              writes.push({
                collection: "trucks",
                id: t.id,
                data: {
                  assignedEquipmentId: v.id,
                  assignedDriverId: driver?.id || null,
                  assignedDriverName: driver?.name || null,
                },
              });
              drivers
                .filter(
                  (d) => d.assignedTruckId === t.id && d.id !== driver?.id,
                )
                .forEach((d) =>
                  writes.push({
                    collection: "drivers",
                    id: d.id,
                    data: { assignedTruckId: null, assignedVehiclePlate: null },
                  }),
                );
              if (driver)
                writes.push({
                  collection: "drivers",
                  id: driver.id,
                  data: {
                    assignedTruckId: t.id,
                    assignedVehiclePlate: t.plate,
                  },
                });
            }
            return;
          }
          const old = trucks.find((t) => t.id === v.id);
          const driver = drivers.find(
            (d) => d.id === v.defaultDriverId && d.active !== false,
          );
          writes.push({
            collection: "trucks",
            id: v.id,
            data: {
              ...(old ? {} : { seq: 0, description: "", status: "ACTIVE" }),
              id: v.id,
              plate: v.plateNo,
              plateNorm: normalizePlate(v.plateNo),
              normalizedPlate: normalizePlate(v.plateNo),
              type: v.type,
              equipmentNo: v.equipmentNo,
              isThirdParty: v.isThirdParty,
              assignedDriverId: driver?.id || null,
              assignedDriverName: driver?.name || null,
            },
          });
          drivers
            .filter((d) => d.assignedTruckId === v.id && d.id !== driver?.id)
            .forEach((d) =>
              writes.push({
                collection: "drivers",
                id: d.id,
                data: { assignedTruckId: null, assignedVehiclePlate: null },
              }),
            );
          trucks
            .filter(
              (t) =>
                driver && t.assignedDriverId === driver.id && t.id !== v.id,
            )
            .forEach((t) =>
              writes.push({
                collection: "trucks",
                id: t.id,
                data: { assignedDriverId: null, assignedDriverName: null },
              }),
            );
          if (driver)
            writes.push({
              collection: "drivers",
              id: driver.id,
              data: { assignedTruckId: v.id, assignedVehiclePlate: v.plateNo },
            });
        });
      for (const v of previous.vehicles.filter(
        (v) => !next.vehicles.some((n) => n.id === v.id),
      ))
        if (equipment.some((e) => e.id === v.id)) await deleteEquipment(v.id);
        else await deleteTruck(v.id);
      if (
        JSON.stringify(next.commodities) !==
        JSON.stringify(previous.commodities)
      ) {
        next.commodities.forEach((c) => {
          const existing = commodities.find((x) => x.canonical === c.canonical);
          writes.push({
            collection: "commodities",
            id: existing?.id || newId(),
            data: { ...c, defaultPackaging: existing?.defaultPackaging || "" },
          });
        });
        commodities
          .filter(
            (c) => !next.commodities.some((n) => n.canonical === c.canonical),
          )
          .forEach((c) =>
            writes.push({ collection: "commodities", id: c.id, remove: true }),
          );
      }
      if (JSON.stringify(next.storeMap) !== JSON.stringify(previous.storeMap)) {
        Object.entries(next.storeMap).forEach(([destination, storeName]) => {
          const old = stores.find((s) => s.destination === destination);
          writes.push({
            collection: "stores",
            id: old?.id || newId(),
            data: {
              key: destination,
              destination,
              storeName,
              customer: old?.customer || "",
              region: old?.region || "",
            },
          });
        });
        stores
          .filter((s) => !(s.destination in next.storeMap))
          .forEach((s) =>
            writes.push({ collection: "stores", id: s.id, remove: true }),
          );
      }
      await fleetRepository.commit(writes);
    });
  const restoreFullBackup = async (
    data: any,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      return await run(async () => {
        if (
          data?.meta?.schema !== "tls-lms" ||
          !Array.isArray(data.trucks) ||
          !Array.isArray(data.drivers)
        )
          throw new Error("A complete TLMS backup is required.");
        const groups: [string, any][] = [
          ["trucks", data.trucks],
          ["equipment", data.equipment],
          ["drivers", data.drivers],
          ["commodities", data.commodities],
          ["stores", data.stores],
          ["cash_accounts", data.cashbook?.accounts],
          ["cashbook", data.cashbook?.transactions],
          ["diesel_logs", data.dieselLogs],
          ["data_quality", data.dataQuality],
          ["cash_employees", data.cashEmployees],
        ];
        const writes: Write[] = [];
        for (const [name, records] of groups) {
          if (!Array.isArray(records))
            throw new Error(`Missing backup section: ${name}`);
          records.forEach((r) => {
            if (!r?.id) throw new Error(`Missing ID in ${name}`);
            writes.push({ collection: name, id: r.id, data: r });
          });
        }
        if (
          !data.schedules ||
          !data.manifests ||
          !Array.isArray(data.kmRecords)
        )
          throw new Error("Missing schedules, manifests or KM records.");
        const canonical = data.kmRecords.map((r: KmRecord) =>
          canonicalKm(r, data.trucks),
        );
        Object.entries(data.schedules).forEach(([date, s]) =>
          writes.push({ collection: "schedules", id: date, data: s as object }),
        );
        Object.entries(data.manifests).forEach(([date, tags]) =>
          writes.push({
            collection: "manifests",
            id: date,
            data: { date, tags: normalizeTags(tags as Record<string, string>) },
          }),
        );
        await fleetRepository.commit(writes);
        if (canonical.length) {
          const result = await fleetRepository.importKm(canonical, data.trucks);
          if (result.status !== "completed")
            throw new Error(
              `Only ${result.persistedRecordCount}/${result.expectedRecordCount} KM records verified.`,
            );
        }
        if (Array.isArray(data.learnedRules))
          await fleetRepository.save("app_state", "learnedRules", {
            rules: data.learnedRules,
          });
        return {
          success: true,
          message:
            "Backup merged into Firestore. Existing records absent from the backup were retained; KM persistence verified.",
        };
      });
    } catch (error) {
      return {
        success: false,
        message: `Restore failed; some batches may already be saved. ${String(error)}`,
      };
    }
  };
  const exportFullBackup = () => {
    const payload = {
      meta: {
        schema: "tls-lms",
        version: "2.0",
        exportedAt: new Date().toISOString(),
        exportedBy: profile?.email || user?.email || "Admin",
        recordCounts: {
          trucks: trucks.length,
          equipment: equipment.length,
          drivers: drivers.length,
          cashTransactions: cashTransactions.length,
          kmRecords: kmRecords.length,
          dieselLogs: dieselLogs.length,
          commodities: commodities.length,
          stores: stores.length,
          cashAccounts: cashAccounts.length,
          cashEmployees: cashEmployees.length,
          learnedRules: learnedRules.length,
        },
      },
      trucks,
      equipment,
      drivers,
      commodities,
      stores,
      schedules,
      manifests,
      cashbook: {
        accounts: cashAccounts,
        transactions: cashTransactions,
      },
      cashEmployees,
      kmRecords,
      dieselLogs,
      dataQuality: conflicts,
      learnedRules,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TLS_LMS_Master_Backup_${ksaDateISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const value: LmsContextType = {
    historicalTrucks: allTrucks,
    updateDailyKm,
    updateOdometer,
    trucks,
    equipment,
    drivers,
    commodities,
    stores,
    schedules,
    manifests,
    cashTransactions,
    cashAccounts,
    cashEmployees,
    kmRecords,
    dieselLogs,
    conflicts,
    learnedRules,
    saveTruck,
    deleteTruck,
    saveEquipment,
    deleteEquipment,
    saveDriver,
    deleteDriver,
    saveDailySchedule,
    deleteDailySchedule,
    saveDailyManifest,
    saveMultiDayManifests,
    addCashTransaction,
    addCashAccount,
    deleteCashAccount,
    addCashEmployee,
    deleteCashEmployee,
    reverseCashTransaction,
    deleteCashTransaction,
    addKmRecord,
    batchSaveKmRecords,
    deleteKmRecord,
    addDieselLog,
    resolveConflict,
    restoreFullBackup,
    exportFullBackup,
    learnHistoricalRules,
    syncStatus,
    errorStates,
    loadingStates,
    selectedKmMonth,
    setSelectedKmMonth,
    branding,
    saveBranding,
    saveTimetableRegistry,
    dataSourceStatus: user ? "Firestore" : "Not authenticated",
  };
  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
};
export const useLms = () => {
  const value = useContext(LmsContext);
  if (!value) throw new Error("useLms requires LmsProvider");
  return value;
};
