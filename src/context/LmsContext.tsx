import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { useAuth } from './AuthContext';
import { ksaDateISO } from '../utils/dateUtils';
import {
  Truck, Equipment, Driver, Commodity, StoreMapItem,
  DailySchedule, DailyManifest, CashTransaction, CashAccount,
  KmRecord, DieselLog, DataConflict, LearnedRule
} from '../types';
import {
  INITIAL_TRUCKS, INITIAL_EQUIPMENT, INITIAL_DRIVERS,
  INITIAL_COMMODITIES, INITIAL_STORES, INITIAL_DATA_CONFLICTS,
  INITIAL_CASH_ACCOUNTS
} from '../data/seedData';
import {
  generateSeedKmRecords, generateSeedDieselLogs,
  PRE_TRAINED_LEARNED_RULES, generateSeedSchedules
} from '../data/historicalData';
import { SEED_OCTOBER_1_4_MANIFESTS } from '../utils/multiDayManifestParser';
import { OCTOBER_DAILY_SCHEDULES, OCTOBER_CONFIRMED_MANIFESTS } from '../data/octoberSchedules';

interface LmsContextType {
  trucks: Truck[];
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
  
  saveDailySchedule: (date: string, rows: any[], syncToManifest?: boolean) => Promise<void>;
  deleteDailySchedule: (date: string) => Promise<void>;
  saveDailyManifest: (date: string, tags: Record<string, string>) => Promise<void>;
  saveMultiDayManifests: (batchData: Record<string, Record<string, string>>) => Promise<void>;
  
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt'>) => Promise<void>;
  addCashAccount: (account: Omit<CashAccount, 'id'>) => Promise<void>;
  deleteCashAccount: (id: string) => Promise<void>;
  addCashEmployee: (name: string) => Promise<void>;
  deleteCashEmployee: (id: string) => Promise<void>;
  reverseCashTransaction: (id: string, reason?: string) => Promise<void>;
  deleteCashTransaction: (id: string) => Promise<void>;
  
  addKmRecord: (rec: Omit<KmRecord, 'id'>) => Promise<void>;
  batchSaveKmRecords: (records: (Omit<KmRecord, 'id'> | KmRecord)[]) => Promise<void>;
  deleteKmRecord: (id: string) => Promise<void>;
  addDieselLog: (log: Omit<DieselLog, 'id'>) => Promise<void>;
  
  resolveConflict: (conflictId: string, note?: string) => Promise<void>;
  restoreFullBackup: (jsonContent: any) => Promise<{ success: boolean; message: string }>;
  exportFullBackup: () => void;
  learnHistoricalRules: (rules: LearnedRule[]) => Promise<void>;
}

const LmsContext = createContext<LmsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tls_lms_offline_cache_v2';

function normalizeManifestTags(tags: Record<string, string>, drivers: Driver[]): Record<string, string> {
  const normalized: Record<string, string> = {};
  Object.entries(tags || {}).forEach(([key, value]) => {
    const index = Number(key);
    const driver = key.trim() !== '' && Number.isInteger(index) && index >= 0 ? drivers[index] : undefined;
    normalized[driver?.id || key] = value;
  });
  return normalized;
}

export const LmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();

  const [trucks, setTrucks] = useState<Truck[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_trucks');
    return saved ? JSON.parse(saved) : INITIAL_TRUCKS;
  });

  const [equipment, setEquipment] = useState<Equipment[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_equip');
    return saved ? JSON.parse(saved) : INITIAL_EQUIPMENT;
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    let base = INITIAL_DRIVERS;
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_drivers_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Accept the user-managed offline list, including intentional deletions.
        // A fixed-length check restored deleted drivers after refresh.
        if (Array.isArray(parsed)) {
          base = parsed;
        }
      } catch (e) {
        // fallback to INITIAL_DRIVERS
      }
    }
    // Always ensure October 1–5 manifest seed tags are populated into driver history
    return base.map((d, idx) => {
      const hist = { ...(d.history || {}) };
      Object.entries(SEED_OCTOBER_1_4_MANIFESTS).forEach(([dt, tags]) => {
        if (tags[idx] && !hist[dt]) {
          hist[dt] = tags[idx];
        }
      });
      Object.entries(OCTOBER_CONFIRMED_MANIFESTS).forEach(([dt, tags]) => {
        if (tags[idx] && !hist[dt]) {
          hist[dt] = tags[idx];
        }
      });
      return { ...d, history: hist };
    });
  });

  const [commodities, setCommodities] = useState<Commodity[]>(() => { try { const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_commodities'); return saved ? JSON.parse(saved) : INITIAL_COMMODITIES; } catch { return INITIAL_COMMODITIES; } });
  const [stores, setStores] = useState<StoreMapItem[]>(() => { try { const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_stores'); return saved ? JSON.parse(saved) : INITIAL_STORES; } catch { return INITIAL_STORES; } });
  const [conflicts, setConflicts] = useState<DataConflict[]>(() => { try { const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_conflicts'); return saved ? JSON.parse(saved) : INITIAL_DATA_CONFLICTS; } catch { return INITIAL_DATA_CONFLICTS; } });
  const [cashEmployees, setCashEmployees] = useState<{ id: string; name: string }[]>(() => { try { const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_cashEmployees'); return saved ? JSON.parse(saved) : []; } catch { return []; } });
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_accounts');
      return saved ? JSON.parse(saved) as CashAccount[] : INITIAL_CASH_ACCOUNTS;
    } catch {
      return INITIAL_CASH_ACCOUNTS;
    }
  });

  const [schedules, setSchedules] = useState<Record<string, DailySchedule>>(() => {
    const seedSched: Record<string, DailySchedule> = { ...generateSeedSchedules(), ...OCTOBER_DAILY_SCHEDULES };
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_schedules_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = { ...seedSched, ...parsed };
        // Ensure October schedules (Oct 1–5) are always present with their real rows
        Object.entries(OCTOBER_DAILY_SCHEDULES).forEach(([dt, sched]) => {
          if (!merged[dt] || !merged[dt].rows || merged[dt].rows.length === 0) {
            merged[dt] = sched;
          }
        });
        return merged;
      } catch (e) {
        return seedSched;
      }
    }
    return seedSched;
  });

  const [manifests, setManifests] = useState<Record<string, Record<string, string>>>(() => {
    const seedManifests: Record<string, Record<string, string>> = {};
    drivers.forEach((driver, idx) => {
      Object.entries(driver.history || {}).forEach(([date, tag]) => {
        if (!seedManifests[date]) seedManifests[date] = {};
        seedManifests[date][driver.id] = tag;
      });
    });
    [SEED_OCTOBER_1_4_MANIFESTS, OCTOBER_CONFIRMED_MANIFESTS].forEach(source => {
      Object.entries(source).forEach(([date, tags]) => {
        if (!seedManifests[date]) seedManifests[date] = {};
        Object.entries(tags).forEach(([key, tag]) => {
          const index = Number(key);
          const driver = key.trim() !== '' && Number.isInteger(index) && index >= 0 ? drivers[index] : undefined;
          seedManifests[date][driver?.id || key] = tag;
        });
      });
    });
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_manifests_v3');
    if (!saved) return seedManifests;
    try {
      const parsed = JSON.parse(saved) as Record<string, Record<string, string>>;
      const normalizedParsed: Record<string, Record<string, string>> = {};
      Object.entries(parsed).forEach(([date, tags]) => { normalizedParsed[date] = normalizeManifestTags(tags, drivers); });
      const merged = { ...seedManifests, ...normalizedParsed };
      [SEED_OCTOBER_1_4_MANIFESTS, OCTOBER_CONFIRMED_MANIFESTS].forEach(source => {
        Object.entries(source).forEach(([date, tags]) => {
          const normalizedSeed: Record<string, string> = {};
          Object.entries(tags).forEach(([key, tag]) => {
            const index = Number(key);
            const driver = key.trim() !== '' && Number.isInteger(index) && index >= 0 ? drivers[index] : undefined;
            normalizedSeed[driver?.id || key] = tag;
          });
          merged[date] = { ...(merged[date] || {}), ...normalizedSeed };
        });
      });
      return merged;
    } catch { return seedManifests; }
  });

  const driversRef = useRef(drivers);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_cash');
    return saved ? JSON.parse(saved) : [];
  });

  const [kmRecords, setKmRecords] = useState<KmRecord[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_km');
    return saved ? JSON.parse(saved) : generateSeedKmRecords();
  });

  const [dieselLogs, setDieselLogs] = useState<DieselLog[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_diesel');
    return saved ? JSON.parse(saved) : generateSeedDieselLogs();
  });

  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_rules');
    return saved ? JSON.parse(saved) : PRE_TRAINED_LEARNED_RULES;
  });

  // Sync to local cache whenever state changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY + '_trucks', JSON.stringify(trucks));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_equip', JSON.stringify(equipment));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_drivers_v3', JSON.stringify(drivers));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_schedules_v3', JSON.stringify(schedules));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_manifests_v3', JSON.stringify(manifests));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_cash', JSON.stringify(cashTransactions));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_accounts', JSON.stringify(cashAccounts));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_km', JSON.stringify(kmRecords));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_diesel', JSON.stringify(dieselLogs));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_rules', JSON.stringify(learnedRules));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_commodities', JSON.stringify(commodities));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_stores', JSON.stringify(stores));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_conflicts', JSON.stringify(conflicts));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_cashEmployees', JSON.stringify(cashEmployees));
  }, [trucks, equipment, drivers, schedules, manifests, cashTransactions, cashAccounts, kmRecords, dieselLogs, learnedRules, commodities, stores, conflicts, cashEmployees]);

  // Firestore real-time subscriptions if user or profile is authenticated
  useEffect(() => {
    if (!user && !profile) return;

    // Listen to trucks
    const unsubTrucks = onSnapshot(collection(db, 'trucks'), (snapshot) => {
      const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Truck)).sort((a, b) => (a.seq || 0) - (b.seq || 0));
      setTrucks(remote);
    }, (err) => {
      console.warn("Trucks Firestore listener notice:", err.message);
    });

    const unsubEquipment = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      setEquipment(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment)).sort((a, b) => (a.seq || 0) - (b.seq || 0)));
    }, (err) => {
      console.warn("Equipment Firestore listener notice:", err.message);
    });

    // Firestore is authoritative: merging a smaller remote list resurrected deleted drivers.
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Driver)).sort((a, b) => (a.seq || 0) - (b.seq || 0));
      setDrivers(remote);
    }, (err) => {
      console.warn("Drivers Firestore listener notice:", err.message);
    });

    // Listen to manifests
    const unsubManifests = onSnapshot(collection(db, 'manifests'), (snapshot) => {
      const remote: Record<string, Record<string, string>> = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data?.date && data?.tags && typeof data.tags === 'object') remote[data.date] = normalizeManifestTags(data.tags, driversRef.current);
      });
      setManifests(remote);
    }, (err) => {
      console.warn("Manifests Firestore listener notice:", err.message);
    });

    // Listen to schedules
    const unsubSchedules = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const remote: Record<string, DailySchedule> = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as DailySchedule;
        if (data?.date && Array.isArray(data.rows)) remote[data.date] = data;
      });
      setSchedules(remote);
    }, (err) => {
      console.warn("Schedules Firestore listener notice:", err.message);
    });

    // Listen to cash accounts
    const unsubCashAccounts = onSnapshot(collection(db, 'cash_accounts'), (snapshot) => {
      const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CashAccount));
      const remoteIds = new Set(remote.map(account => account.id));
      // Keep built-in accounts available until explicitly migrated; overlay remote versions by ID.
      const defaults = INITIAL_CASH_ACCOUNTS.filter(account => !remoteIds.has(account.id));
      setCashAccounts([...defaults, ...remote]);
    }, (err) => {
      console.warn("Cash accounts Firestore listener notice:", err.message);
    });

    // Listen to Cashbook employee directory (separate from fleet driver records)
    const unsubCashEmployees = onSnapshot(collection(db, 'cash_employees'), (snapshot) => {
      setCashEmployees(snapshot.docs.map(d => ({ id: d.id, name: String(d.data().name || '') })).filter(e => e.name));
    }, (err) => {
      console.warn("Cashbook employee listener notice:", err.message);
    });

    // Listen to cash transactions
    const unsubCash = onSnapshot(query(collection(db, 'cashbook'), orderBy('dateISO', 'desc')), (snapshot) => {
      setCashTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CashTransaction)));
    }, (err) => {
      console.warn("Cashbook Firestore listener notice:", err.message);
    });

    // Listen to km records
    const unsubKm = onSnapshot(query(collection(db, 'km_records'), orderBy('date', 'desc')), (snapshot) => {
      setKmRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KmRecord)));
    }, (err) => {
      console.warn("KM Firestore listener notice:", err.message);
    });

    const unsubDiesel = onSnapshot(query(collection(db, 'diesel_logs'), orderBy('date', 'desc')), (snapshot) => {
      setDieselLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DieselLog)));
    }, (err) => {
      console.warn("Diesel logs Firestore listener notice:", err.message);
    });

    const unsubRules = onSnapshot(doc(db, 'app_state', 'learnedRules'), (snapshot) => {
      const rules = snapshot.exists() ? snapshot.data()?.rules : undefined;
      if (Array.isArray(rules)) setLearnedRules(rules as LearnedRule[]);
    }, (err) => {
      console.warn("Learned rules Firestore listener notice:", err.message);
    });

    return () => {
      unsubTrucks();
      unsubEquipment();
      unsubDrivers();
      unsubManifests();
      unsubSchedules();
      unsubCash();
      unsubCashAccounts();
      unsubCashEmployees();
      unsubKm();
      unsubDiesel();
      unsubRules();
    };
  }, [user, profile]);

  // Actions
  const saveTruck = async (truck: Truck) => {
    if (user || profile) await setDoc(doc(db, 'trucks', truck.id), truck);
    setTrucks(prev => {
      const index = prev.findIndex(item => item.id === truck.id);
      if (index >= 0) { const next = [...prev]; next[index] = truck; return next; }
      return [...prev, truck].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    });
  };

  const deleteTruck = async (id: string) => {
    if (user || profile) await deleteDoc(doc(db, 'trucks', id));
    setTrucks(prev => prev.filter(item => item.id !== id));
  };

  const saveEquipment = async (equip: Equipment) => {
    if (user || profile) await setDoc(doc(db, 'equipment', equip.id), equip);
    setEquipment(prev => {
      const index = prev.findIndex(item => item.id === equip.id);
      if (index >= 0) { const next = [...prev]; next[index] = equip; return next; }
      return [...prev, equip].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    });
  };

  const deleteEquipment = async (id: string) => {
    if (user || profile) await deleteDoc(doc(db, 'equipment', id));
    setEquipment(prev => prev.filter(item => item.id !== id));
  };

  const saveDriver = async (driver: Driver) => {
    if (user || profile) await setDoc(doc(db, 'drivers', driver.id), driver);
    setDrivers(prev => {
      const index = prev.findIndex(item => item.id === driver.id);
      if (index >= 0) { const next = [...prev]; next[index] = driver; return next; }
      return [...prev, driver].sort((a, b) => (a.seq || 0) - (b.seq || 0));
    });
  };

  const deleteDriver = async (id: string) => {
    const existingDriver = drivers.find(driver => driver.id === id);
    if (!existingDriver) return;
    if (!auth.currentUser && (user || profile)) {
      throw new Error('A valid signed-in Firebase account is required to archive a driver.');
    }

    const archivedDriver: Driver = {
      ...existingDriver,
      active: false,
      status: 'INCOMPLETE',
      assignedTruckId: null,
      assignedVehiclePlate: null,
      notes: [existingDriver.notes, 'Archived ' + ksaDateISO()].filter(Boolean).join(' | ')
    };
    const affectedTrucks = trucks.filter(truck => truck.assignedDriverId === id);
    if (user || profile) {
      const batch = writeBatch(db);
      affectedTrucks.forEach(truck => {
        batch.set(doc(db, 'trucks', truck.id), {
          ...truck,
          assignedDriverId: null,
          assignedDriverName: null
        });
      });
      batch.set(doc(db, 'drivers', id), archivedDriver);
      await batch.commit();
    }

    setTrucks(prev => prev.map(truck => truck.assignedDriverId === id
      ? { ...truck, assignedDriverId: null, assignedDriverName: null }
      : truck));
    setDrivers(prev => prev.map(driver => driver.id === id ? archivedDriver : driver));
  };

  const saveDailySchedule = async (date: string, rows: any[], syncToManifest = true) => {
    const schedObj: DailySchedule = {
      date, rows, confirmed: true, updatedAt: new Date().toISOString(),
      updatedBy: profile?.email || user?.email || 'Dispatcher'
    };
    if (user || profile) await setDoc(doc(db, 'schedules', date), schedObj);
    setSchedules(prev => ({ ...prev, [date]: schedObj }));

    if (syncToManifest && rows && rows.length > 0) {
      const currentManifest: Record<string, string> = { ...(manifests[date] || {}) };
      rows.forEach(row => {
        if (!row.driverName && !row.plateNo) return;
        const driver = drivers.find(d => {
          const dNorm = (d.name || '').toUpperCase().replace(/\s+/g, ' ').trim();
          const rNorm = (row.driverName || '').toUpperCase().replace(/\s+/g, ' ').trim();
          const nameMatch = dNorm && rNorm && (dNorm.includes(rNorm) || rNorm.includes(dNorm));
          const plateMatch = row.plateNo && d.assignedVehiclePlate && row.plateNo.replace(/\s+/g, '').toUpperCase() === d.assignedVehiclePlate.replace(/\s+/g, '').toUpperCase();
          return Boolean(nameMatch || plateMatch);
        });
        if (driver) {
          const commRaw = (row.commodity || '').split('/')[0].trim();
          const comm = commRaw.replace(/\s+Granular$/i, '').trim();
          const customer = row.customer || row.supplier || row.store || 'Customer';
          const source = row.source || 'Yanbu';
          currentManifest[driver.id] = (comm ? comm + ' ' : '') + 'Supply for ' + customer + ' - Under Loading at ' + source;
        }
      });
      if (user || profile) await setDoc(doc(db, 'manifests', date), {
        date, tags: currentManifest, confirmedAt: new Date().toISOString(),
        confirmedBy: profile?.email || user?.email || 'Dispatcher', driverCount: Object.keys(currentManifest).length
      });
      setManifests(prev => ({ ...prev, [date]: currentManifest }));
    }
  };

  const deleteDailySchedule = async (date: string) => {
    if (user || profile) await deleteDoc(doc(db, 'schedules', date));
    setSchedules(prev => { const next = { ...prev }; delete next[date]; return next; });
  };

  const saveDailyManifest = async (date: string, tags: Record<string, string>) => {
    const normalized: Record<string, string> = {};
    Object.entries(tags || {}).forEach(([key, value]) => {
      const numericKey = key.trim() !== '' && Number.isInteger(Number(key));
      const driver = numericKey ? drivers[Number(key)] : undefined;
      normalized[driver?.id || key] = value;
    });
    if (user || profile) await setDoc(doc(db, 'manifests', date), {
      date, tags: normalized, confirmedAt: new Date().toISOString(),
      confirmedBy: profile?.email || user?.email || 'Operator', driverCount: Object.keys(normalized).length
    });
    setManifests(prev => ({ ...prev, [date]: { ...(prev[date] || {}), ...normalized } }));
    setDrivers(prev => prev.map(driver => {
      const tag = normalized[driver.id];
      return tag ? { ...driver, history: { ...(driver.history || {}), [date]: tag } } : driver;
    }));
  };

  const saveMultiDayManifests = async (batchData: Record<string, Record<string, string>>) => {
    const normalizedBatch: Record<string, Record<string, string>> = {};
    Object.entries(batchData).forEach(([date, tags]) => {
      const normalized: Record<string, string> = {};
      Object.entries(tags || {}).forEach(([key, value]) => {
        const numericKey = key.trim() !== '' && Number.isInteger(Number(key));
        const driver = numericKey ? drivers[Number(key)] : undefined;
        normalized[driver?.id || key] = value;
      });
      normalizedBatch[date] = normalized;
    });
    if (user || profile) {
      for (const [date, tags] of Object.entries(normalizedBatch)) {
        await setDoc(doc(db, 'manifests', date), {
          date, tags, confirmedAt: new Date().toISOString(),
          confirmedBy: profile?.email || user?.email || 'Dispatcher', driverCount: Object.keys(tags).length
        });
      }
    }
    setManifests(prev => {
      const next = { ...prev };
      Object.entries(normalizedBatch).forEach(([date, tags]) => { next[date] = { ...(next[date] || {}), ...tags }; });
      return next;
    });
    setDrivers(prev => prev.map(driver => {
      const history = { ...(driver.history || {}) };
      Object.entries(normalizedBatch).forEach(([date, tags]) => { if (tags[driver.id]) history[date] = tags[driver.id]; });
      return { ...driver, history };
    }));
  };

  const addCashTransaction = async (txData: Omit<CashTransaction, 'id' | 'createdAt'>) => {
    const id = 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newTx: CashTransaction = {
      ...txData,
      id,
      createdAt: new Date().toISOString(),
      createdBy: profile?.email || user?.email || 'Cashier'
    };

    if (!(auth.currentUser || user)) {
      throw new Error('You are not signed in to Firebase. Sign out, then sign in using your Firebase Authentication account before posting Cashbook transactions.');
    }
    try {
      await setDoc(doc(db, 'cashbook', id), newTx);
    } catch (error) {
      if (error instanceof Error && /permission-denied|insufficient permissions/i.test(error.message)) {
        throw new Error('Firebase denied this Cashbook transaction. Confirm Firestore rules are published to the TLMS database and that your Firebase user has the Admin or Cashier role.');
      }
      throw error;
    }
    setCashTransactions(prev => [newTx, ...prev]);
  };

  const addCashAccount = async (accountData: Omit<CashAccount, 'id'>) => {
    const account: CashAccount = {
      ...accountData,
      id: 'acc-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
    };
    if (!(auth.currentUser || user)) throw new Error('You are not signed in to Firebase. Sign in with your Firebase Authentication account to create Cashbook accounts.');
    try {
      await setDoc(doc(db, 'cash_accounts', account.id), account);
    } catch (error) {
      if (error instanceof Error && /permission-denied|insufficient permissions/i.test(error.message)) {
        throw new Error('Firebase denied this account change. Confirm Firestore rules are published to the TLMS database and that your Firebase user has the Admin or Cashier role.');
      }
      throw error;
    }
    setCashAccounts(prev => [...prev, account]);
  };

  const addCashEmployee = async (rawName: string) => {
    const name = rawName.trim();
    if (!name) throw new Error('Employee name is required.');
    if (cashEmployees.some(employee => employee.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('This employee already exists in the Cashbook directory.');
    }
    const id = 'emp-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    if (!(auth.currentUser || user)) throw new Error('You are not signed in to Firebase. Sign out, then sign in using your Firebase Authentication account before managing Cashbook employees.');
    try {
      await setDoc(doc(db, 'cash_employees', id), { name, createdAt: new Date().toISOString() });
    } catch (error) {
      if (error instanceof Error && /permission-denied|insufficient permissions/i.test(error.message)) {
        throw new Error('Firebase denied this employee change. Confirm Firestore rules are published to the TLMS database and that your Firebase user has the Admin or Cashier role.');
      }
      throw error;
    }
  };

  const deleteCashEmployee = async (id: string) => {
    if (!(auth.currentUser || user)) throw new Error('You are not signed in to Firebase. Sign in with your Firebase Authentication account to manage Cashbook employees.');
    try {
      await deleteDoc(doc(db, 'cash_employees', id));
    } catch (error) {
      if (error instanceof Error && /permission-denied|insufficient permissions/i.test(error.message)) {
        throw new Error('Firebase denied this employee removal. Confirm Firestore rules are published to the TLMS database and that your Firebase user has the Admin or Cashier role.');
      }
      throw error;
    }
  };

  const deleteCashAccount = async (id: string) => {
    if (INITIAL_CASH_ACCOUNTS.some(account => account.id === id)) {
      throw new Error('Built-in Cashbook accounts cannot be deleted.');
    }
    if (!(auth.currentUser || user)) throw new Error('You are not signed in to Firebase. Sign in with your Firebase Authentication account to remove Cashbook accounts.');
    try {
      await deleteDoc(doc(db, 'cash_accounts', id));
    } catch (error) {
      if (error instanceof Error && /permission-denied|insufficient permissions/i.test(error.message)) {
        throw new Error('Firebase denied this account deletion. Confirm Firestore rules are published to the TLMS database and that your Firebase user has the Admin role.');
      }
      throw error;
    }
    setCashAccounts(prev => prev.filter(account => account.id !== id));
  };

  const reverseCashTransaction = async (id: string, reason?: string) => {
    const original = cashTransactions.find(tx => tx.id === id);
    if (!original) return;
    const reversalId = 'REV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const reversal: CashTransaction = {
      id: reversalId, date: ksaDateISO(), dateISO: ksaDateISO(), account: original.account, employee: original.employee,
      type: 'Reversal', category: original.category, amount: Math.abs(original.amount),
      description: 'Reversal of ' + id + (reason ? ': ' + reason : ''), status: 'Posted', reversalOf: id, reversedType: original.type,
      createdAt: new Date().toISOString(), createdBy: profile?.email || user?.email || 'Cashier'
    };
    if (user || profile) {
      await setDoc(doc(db, 'cashbook', reversalId), reversal);
      await updateDoc(doc(db, 'cashbook', id), { status: 'Reversed' });
    }
    setCashTransactions(prev => [reversal, ...prev.map(tx => tx.id === id ? { ...tx, status: 'Reversed' as const } : tx)]);
  };

  const deleteCashTransaction = async (id: string) => {
    if (user || profile) await deleteDoc(doc(db, 'cashbook', id));
    setCashTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const addKmRecord = async (rec: Omit<KmRecord, 'id'>) => {
    const normalizedVehicle = rec.veh.toUpperCase().replace(/\s+/g, '');
    const existing = kmRecords.find(item => item.date === rec.date && item.veh.toUpperCase().replace(/\s+/g, '') === normalizedVehicle);
    const id = existing?.id || ('KM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
    const newRecord: KmRecord = { ...rec, id, loggedBy: profile?.email || user?.email || 'Dispatcher' };
    if (user || profile) await setDoc(doc(db, 'km_records', id), newRecord);
    setKmRecords(prev => {
      const index = prev.findIndex(item => item.id === id || (item.date === rec.date && item.veh.toUpperCase().replace(/\s+/g, '') === normalizedVehicle));
      if (index >= 0) { const next = [...prev]; next[index] = { ...next[index], ...newRecord, id: next[index].id }; return next; }
      return [newRecord, ...prev];
    });
  };

  const batchSaveKmRecords = async (records: (Omit<KmRecord, 'id'> | KmRecord)[]) => {
    if (!records.length) return;

    // Generate each record ID once and reuse it for both local state and Firestore.
    // Previously the two loops generated different IDs, which could duplicate records on refresh.
    const preparedByKey = new Map<string, KmRecord>();
    records.forEach(rec => {
      const normalizedPlate = rec.veh.toUpperCase().replace(/\s+/g, '');
      const key = `${rec.date}__${normalizedPlate}`;
      const existing = kmRecords.find(
        item => item.date === rec.date && item.veh.toUpperCase().replace(/\s+/g, '') === normalizedPlate
      );
      const id = ('id' in rec && rec.id) ? rec.id : existing?.id ||
        ('KM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
      preparedByKey.set(key, {
        ...rec,
        id,
        loggedBy: profile?.email || user?.email || 'Dispatcher'
      } as KmRecord);
    });
    const prepared = Array.from(preparedByKey.values());

    setKmRecords(prev => {
      const copy = [...prev];
      prepared.forEach(fullRec => {
        const existingIdx = copy.findIndex(
          item => item.date === fullRec.date && item.veh.toUpperCase().replace(/\s+/g, '') === fullRec.veh.toUpperCase().replace(/\s+/g, '')
        );
        if (existingIdx >= 0) {
          copy[existingIdx] = { ...copy[existingIdx], ...fullRec, id: copy[existingIdx].id };
        } else {
          copy.push(fullRec);
        }
      });
      return copy;
    });

    if (user || profile) {
      try {
        for (const record of prepared) {
          await setDoc(doc(db, 'km_records', record.id), record);
        }
      } catch (e) {
        console.error("Error saving batch KM records in Firestore:", e);
        throw new Error('KM records were added to the local view but could not be fully synced to Firestore. Check your connection, Firebase Authentication, and Firestore rules.');
      }
    }
  };

  const deleteKmRecord = async (id: string) => {
    if (user || profile) await deleteDoc(doc(db, 'km_records', id));
    setKmRecords(prev => prev.filter(record => record.id !== id));
  };

  const addDieselLog = async (logData: Omit<DieselLog, 'id'>) => {
    const id = 'DSL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newLog: DieselLog = { ...logData, id, loggedBy: profile?.email || user?.email || 'Cashier' };
    if (user || profile) await setDoc(doc(db, 'diesel_logs', id), newLog);
    setDieselLogs(prev => [newLog, ...prev]);
  };

  const resolveConflict = async (conflictId: string, note?: string) => {
    const existing = conflicts.find(item => item.id === conflictId);
    if (!existing) return;
    const resolved = { ...existing, status: 'resolved' as const, issue: note ? existing.issue + ' (Resolved: ' + note + ')' : existing.issue };
    if (user || profile) await setDoc(doc(db, 'data_quality', conflictId), resolved);
    setConflicts(prev => prev.map(item => item.id === conflictId ? resolved : item));
  };

  const learnHistoricalRules = async (rules: LearnedRule[]) => {
    const unique = new Map<string, LearnedRule>();
    [...learnedRules, ...rules].forEach(rule => unique.set(String(rule.driverId || drivers[rule.driverIndex]?.id || rule.driverIndex) + '__' + rule.result, { ...rule, driverId: rule.driverId || drivers[rule.driverIndex]?.id }));
    const nextRules = Array.from(unique.values()).sort((a, b) => b.hits - a.hits);
    if (user || profile) await setDoc(doc(db, 'app_state', 'learnedRules'), { rules: nextRules, updatedAt: new Date().toISOString() });
    setLearnedRules(nextRules);
  };

  const restoreFullBackup = async (data: any): Promise<{ success: boolean; message: string }> => {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { success: false, message: 'Backup must be a JSON object.' };
      if (data.meta?.schema && data.meta.schema !== 'tls-lms') return { success: false, message: 'This file is not a recognized TLMS backup.' };
      const recognized = ['trucks', 'equipment', 'drivers', 'commodities', 'stores', 'schedules', 'manifests', 'kmRecords', 'km', 'dieselLogs', 'diesel', 'dataQuality', 'learnedRules', 'cashEmployees'];
      const found = recognized.some(key => Object.prototype.hasOwnProperty.call(data, key)) || Array.isArray(data.cashbook?.transactions) || Array.isArray(data.cashbook?.accounts);
      if (!found) return { success: false, message: 'No recognized TLMS backup fields were found. Nothing was restored.' };

      const arrayFields: Array<[string, unknown]> = [
        ['trucks', data.trucks], ['equipment', data.equipment], ['drivers', data.drivers], ['commodities', data.commodities],
        ['stores', data.stores], ['kmRecords', data.kmRecords ?? data.km], ['dieselLogs', data.dieselLogs ?? data.diesel],
        ['dataQuality', data.dataQuality], ['learnedRules', data.learnedRules], ['cashEmployees', data.cashEmployees],
        ['cashbook.accounts', data.cashbook?.accounts], ['cashbook.transactions', data.cashbook?.transactions]
      ];
      for (const [name, value] of arrayFields) {
        if (value !== undefined && !Array.isArray(value)) return { success: false, message: 'Invalid backup: ' + name + ' must be an array.' };
        if (Array.isArray(value) && value.some(record => !record || typeof record !== 'object' || !String(record.id || '').trim())) {
          return { success: false, message: 'Invalid backup: every record in ' + name + ' must have an ID.' };
        }
      }
      for (const name of ['schedules', 'manifests']) {
        if (data[name] !== undefined && (!data[name] || typeof data[name] !== 'object' || Array.isArray(data[name]))) {
          return { success: false, message: 'Invalid backup: ' + name + ' must be an object keyed by date.' };
        }
      }
      if (data.cashbook !== undefined && (!data.cashbook || typeof data.cashbook !== 'object' || Array.isArray(data.cashbook))) {
        return { success: false, message: 'Invalid backup: cashbook must be an object.' };
      }
      exportFullBackup();

      const replaceCollection = async (name: string, records: Array<Record<string, any>>) => {
        const incoming = new Map(records.map(record => [String(record.id), record]));
        const snapshot = await getDocs(collection(db, name));
        for (const existing of snapshot.docs) if (!incoming.has(existing.id)) await deleteDoc(doc(db, name, existing.id));
        for (const [id, record] of incoming) await setDoc(doc(db, name, id), record);
      };
      const signedIn = Boolean(user || profile);
      if (signedIn) {
        if (Array.isArray(data.trucks)) await replaceCollection('trucks', data.trucks);
        if (Array.isArray(data.equipment)) await replaceCollection('equipment', data.equipment);
        if (Array.isArray(data.drivers)) await replaceCollection('drivers', data.drivers);
        if (Array.isArray(data.commodities)) await replaceCollection('commodities', data.commodities);
        if (Array.isArray(data.stores)) await replaceCollection('stores', data.stores);
        if (Array.isArray(data.cashbook?.accounts)) await replaceCollection('cash_accounts', data.cashbook.accounts);
        if (Array.isArray(data.cashbook?.transactions)) await replaceCollection('cashbook', data.cashbook.transactions);
        if (Array.isArray(data.cashEmployees)) await replaceCollection('cash_employees', data.cashEmployees);
        if (Array.isArray(data.kmRecords ?? data.km)) await replaceCollection('km_records', data.kmRecords ?? data.km);
        if (Array.isArray(data.dieselLogs ?? data.diesel)) await replaceCollection('diesel_logs', data.dieselLogs ?? data.diesel);
        if (data.schedules) await replaceCollection('schedules', Object.entries(data.schedules).map(([date, item]) => ({ ...(item as object), id: date, date })));
        if (data.manifests) await replaceCollection('manifests', Object.entries(data.manifests).map(([date, tags]) => ({ id: date, date, tags })));
        if (Array.isArray(data.dataQuality)) await replaceCollection('data_quality', data.dataQuality);
        if (Array.isArray(data.learnedRules)) await setDoc(doc(db, 'app_state', 'learnedRules'), { rules: data.learnedRules, updatedAt: new Date().toISOString() });
      }

      if (Array.isArray(data.trucks)) setTrucks(data.trucks as Truck[]);
      if (Array.isArray(data.equipment)) setEquipment(data.equipment as Equipment[]);
      if (Array.isArray(data.drivers)) setDrivers((data.drivers as Driver[]).sort((a, b) => (a.seq || 0) - (b.seq || 0)));
      if (Array.isArray(data.commodities)) setCommodities(data.commodities as Commodity[]);
      if (Array.isArray(data.stores)) setStores(data.stores as StoreMapItem[]);
      if (data.schedules) setSchedules(data.schedules as Record<string, DailySchedule>);
      if (data.manifests) setManifests(data.manifests as Record<string, Record<string, string>>);
      if (Array.isArray(data.cashbook?.accounts)) setCashAccounts(data.cashbook.accounts as CashAccount[]);
      if (Array.isArray(data.cashbook?.transactions)) setCashTransactions(data.cashbook.transactions as CashTransaction[]);
      if (Array.isArray(data.kmRecords ?? data.km)) setKmRecords((data.kmRecords ?? data.km) as KmRecord[]);
      if (Array.isArray(data.dieselLogs ?? data.diesel)) setDieselLogs((data.dieselLogs ?? data.diesel) as DieselLog[]);
      if (Array.isArray(data.dataQuality)) setConflicts(data.dataQuality as DataConflict[]);
      if (Array.isArray(data.learnedRules)) setLearnedRules(data.learnedRules as LearnedRule[]);
      if (Array.isArray(data.cashEmployees)) setCashEmployees(data.cashEmployees as { id: string; name: string }[]);

      const syncNote = signedIn ? ' Firestore collections were synced.' : ' Restored locally only; sign in to sync to Firestore.';
      return {
        success: true,
        message: 'Backup restored: ' + (data.trucks?.length ?? 0) + ' trucks, ' + (data.drivers?.length ?? 0) + ' drivers, ' + (data.equipment?.length ?? 0) + ' equipment, ' + (data.cashbook?.transactions?.length ?? 0) + ' cash transactions, ' + ((data.kmRecords ?? data.km)?.length ?? 0) + ' KM records, and ' + ((data.dieselLogs ?? data.diesel)?.length ?? 0) + ' diesel logs.' + syncNote
      };
    } catch (err: any) {
      return { success: false, message: 'Restore failed: ' + (err?.message || String(err)) + '. If signed in, Firestore may have received part of the update; review the database before retrying.' };
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
          learnedRules: learnedRules.length
        }
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
        transactions: cashTransactions
      },
      cashEmployees,
      kmRecords,
      dieselLogs,
      dataQuality: conflicts,
      learnedRules
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TLS_LMS_Master_Backup_${ksaDateISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const value: LmsContextType = {
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
    learnHistoricalRules
  };

  return <LmsContext.Provider value={value}>{children}</LmsContext.Provider>;
};

export const useLms = () => {
  const ctx = useContext(LmsContext);
  if (!ctx) throw new Error("useLms must be used within an LmsProvider");
  return ctx;
};
