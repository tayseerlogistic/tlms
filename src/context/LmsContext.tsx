import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { useAuth } from './AuthContext';
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
  saveDailyManifest: (date: string, tags: Record<number, string>) => Promise<void>;
  saveMultiDayManifests: (batchData: Record<string, Record<number, string>>) => Promise<void>;
  
  addCashTransaction: (tx: Omit<CashTransaction, 'id' | 'createdAt'>) => Promise<void>;
  reverseCashTransaction: (id: string, reason?: string) => Promise<void>;
  deleteCashTransaction: (id: string) => Promise<void>;
  
  addKmRecord: (rec: Omit<KmRecord, 'id'>) => Promise<void>;
  deleteKmRecord: (id: string) => Promise<void>;
  addDieselLog: (log: Omit<DieselLog, 'id'>) => Promise<void>;
  
  resolveConflict: (conflictId: string, note?: string) => Promise<void>;
  restoreFullBackup: (jsonContent: any) => Promise<{ success: boolean; message: string }>;
  exportFullBackup: () => void;
  learnHistoricalRules: (rules: LearnedRule[]) => void;
}

const LmsContext = createContext<LmsContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'tls_lms_offline_cache_v2';

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
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_drivers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_DRIVERS.length) base = parsed;
      } catch (e) {
        // fallback to INITIAL_DRIVERS
      }
    }
    // Always ensure October 1–4 manifest seed tags are populated into driver history
    return base.map((d, idx) => {
      const hist = { ...(d.history || {}) };
      Object.entries(SEED_OCTOBER_1_4_MANIFESTS).forEach(([dt, tags]) => {
        if (tags[idx] && !hist[dt]) {
          hist[dt] = tags[idx];
        }
      });
      return { ...d, history: hist };
    });
  });

  const [commodities] = useState<Commodity[]>(INITIAL_COMMODITIES);
  const [stores] = useState<StoreMapItem[]>(INITIAL_STORES);
  const [conflicts, setConflicts] = useState<DataConflict[]>(INITIAL_DATA_CONFLICTS);
  const [cashAccounts] = useState<CashAccount[]>(INITIAL_CASH_ACCOUNTS);

  const [schedules, setSchedules] = useState<Record<string, DailySchedule>>(() => {
    const seedSched = generateSeedSchedules();
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_schedules');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...seedSched, ...parsed };
      } catch (e) {
        return seedSched;
      }
    }
    return seedSched;
  });

  const [manifests, setManifests] = useState<Record<string, Record<string, string>>>(() => {
    // Preload complete August 1–31 and September 1–7 seed from drivers history
    const seedManifests: Record<string, Record<string, string>> = {};
    INITIAL_DRIVERS.forEach((d, idx) => {
      if (d.history) {
        Object.entries(d.history).forEach(([dt, tag]) => {
          if (!seedManifests[dt]) seedManifests[dt] = {};
          seedManifests[dt][idx] = tag;
        });
      }
    });

    // Merge October 1–4 pre-seeded manifests
    Object.entries(SEED_OCTOBER_1_4_MANIFESTS).forEach(([dt, tags]) => {
      if (!seedManifests[dt]) seedManifests[dt] = {};
      Object.entries(tags).forEach(([idx, tag]) => {
        seedManifests[dt][idx] = tag;
      });
    });

    const saved = localStorage.getItem(LOCAL_STORAGE_KEY + '_manifests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const merged = { ...seedManifests, ...parsed };
        // Ensure October 1-4 is always populated
        Object.entries(SEED_OCTOBER_1_4_MANIFESTS).forEach(([dt, tags]) => {
          merged[dt] = { ...(merged[dt] || {}), ...tags };
        });
        return merged;
      } catch (e) {
        return seedManifests;
      }
    }
    return seedManifests;
  });

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
    localStorage.setItem(LOCAL_STORAGE_KEY + '_drivers', JSON.stringify(drivers));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_schedules', JSON.stringify(schedules));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_manifests', JSON.stringify(manifests));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_cash', JSON.stringify(cashTransactions));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_km', JSON.stringify(kmRecords));
    localStorage.setItem(LOCAL_STORAGE_KEY + '_diesel', JSON.stringify(dieselLogs));
  }, [trucks, equipment, drivers, schedules, manifests, cashTransactions, kmRecords, dieselLogs]);

  // Firestore real-time subscriptions if user or profile is authenticated
  useEffect(() => {
    if (!user && !profile) return;

    // Listen to trucks
    const unsubTrucks = onSnapshot(collection(db, 'trucks'), (snapshot) => {
      if (!snapshot.empty) {
        const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Truck));
        setTrucks(remote);
      }
    }, (err) => {
      console.warn("Trucks Firestore listener notice:", err.message);
    });

    // Listen to drivers
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      if (!snapshot.empty) {
        const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Driver));
        setDrivers(remote);
      }
    }, (err) => {
      console.warn("Drivers Firestore listener notice:", err.message);
    });

    // Listen to cash transactions
    const unsubCash = onSnapshot(query(collection(db, 'cashbook'), orderBy('dateISO', 'desc'), limit(300)), (snapshot) => {
      if (!snapshot.empty) {
        const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CashTransaction));
        setCashTransactions(remote);
      }
    }, (err) => {
      console.warn("Cashbook Firestore listener notice:", err.message);
    });

    // Listen to km records
    const unsubKm = onSnapshot(query(collection(db, 'km_records'), orderBy('date', 'desc'), limit(300)), (snapshot) => {
      if (!snapshot.empty) {
        const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KmRecord));
        setKmRecords(remote);
      }
    }, (err) => {
      console.warn("KM Firestore listener notice:", err.message);
    });

    return () => {
      unsubTrucks();
      unsubDrivers();
      unsubCash();
      unsubKm();
    };
  }, [user, profile]);

  // Actions
  const saveTruck = async (truck: Truck) => {
    setTrucks(prev => {
      const idx = prev.findIndex(t => t.id === truck.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = truck;
        return copy;
      }
      return [...prev, truck];
    });

    if (user || profile) {
      try {
        await setDoc(doc(db, 'trucks', truck.id), truck);
      } catch (e) {
        console.warn("Error saving truck to Firestore (cached locally):", e);
      }
    }
  };

  const deleteTruck = async (id: string) => {
    setTrucks(prev => prev.filter(t => t.id !== id));
    if (user || profile) {
      try {
        await deleteDoc(doc(db, 'trucks', id));
      } catch (e) {
        console.warn("Error deleting truck from Firestore:", e);
      }
    }
  };

  const saveEquipment = async (equip: Equipment) => {
    setEquipment(prev => {
      const idx = prev.findIndex(e => e.id === equip.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = equip;
        return copy;
      }
      return [...prev, equip];
    });

    if (user || profile) {
      try {
        await setDoc(doc(db, 'equipment', equip.id), equip);
      } catch (e) {
        console.warn("Error saving equipment to Firestore:", e);
      }
    }
  };

  const deleteEquipment = async (id: string) => {
    setEquipment(prev => prev.filter(e => e.id !== id));
    if (user || profile) {
      try {
        await deleteDoc(doc(db, 'equipment', id));
      } catch (e) {
        console.warn("Error deleting equipment from Firestore:", e);
      }
    }
  };

  const saveDriver = async (driver: Driver) => {
    setDrivers(prev => {
      const idx = prev.findIndex(d => d.id === driver.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = driver;
        return copy;
      }
      return [...prev, driver];
    });

    if (user || profile) {
      try {
        await setDoc(doc(db, 'drivers', driver.id), driver);
      } catch (e) {
        console.warn("Error saving driver to Firestore:", e);
      }
    }
  };

  const deleteDriver = async (id: string) => {
    setDrivers(prev => prev.filter(d => d.id !== id));
    if (user || profile) {
      try {
        await deleteDoc(doc(db, 'drivers', id));
      } catch (e) {
        console.warn("Error deleting driver from Firestore:", e);
      }
    }
  };

  const saveDailySchedule = async (date: string, rows: any[], syncToManifest = true) => {
    const schedObj: DailySchedule = {
      date,
      rows,
      confirmed: true,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.email || user?.email || 'Dispatcher'
    };
    setSchedules(prev => ({ ...prev, [date]: schedObj }));

    // Auto-sync timetable dispatched rows into manifests for the date
    if (syncToManifest && rows && rows.length > 0) {
      setManifests(prev => {
        const currentManifest = { ...(prev[date] || {}) };
        rows.forEach(r => {
          if (!r.driverName && !r.plateNo) return;
          const drvIdx = drivers.findIndex(d => {
            const dNorm = (d.name || '').toUpperCase().replace(/\s+/g, ' ').trim();
            const rNorm = (r.driverName || '').toUpperCase().replace(/\s+/g, ' ').trim();
            const nameMatch = dNorm && rNorm && (dNorm.includes(rNorm) || rNorm.includes(dNorm));
            const plateMatch = r.plateNo && d.assignedVehiclePlate &&
              r.plateNo.replace(/\s+/g, '').toUpperCase() === d.assignedVehiclePlate.replace(/\s+/g, '').toUpperCase();
            return nameMatch || plateMatch;
          });

          if (drvIdx >= 0) {
            const commRaw = (r.commodity || '').split('/')[0].trim();
            const comm = commRaw.replace(/\s+Granular$/i, '').trim();
            const cust = r.customer || r.supplier || r.store || 'Customer';
            const src = r.source || 'Yanbu';
            const tag = `${comm ? comm + ' ' : ''}Supply for ${cust} - Under Loading at ${src}`;
            currentManifest[drvIdx] = tag;
          }
        });
        return { ...prev, [date]: currentManifest };
      });
    }

    if (user) {
      try {
        await setDoc(doc(db, 'schedules', date), schedObj);
      } catch (e) {
        console.warn("Error saving schedule to Firestore:", e);
      }
    }
  };

  const saveDailyManifest = async (date: string, tags: Record<number, string>) => {
    setManifests(prev => ({
      ...prev,
      [date]: { ...(prev[date] || {}), ...tags }
    }));

    // Also update driver history records
    setDrivers(prev => {
      const copy = [...prev];
      Object.entries(tags).forEach(([idxStr, tag]) => {
        const idx = Number(idxStr);
        if (copy[idx]) {
          copy[idx] = {
            ...copy[idx],
            history: { ...(copy[idx].history || {}), [date]: tag }
          };
        }
      });
      return copy;
    });

    if (user || profile) {
      try {
        await setDoc(doc(db, 'manifests', date), {
          date,
          tags,
          confirmedAt: new Date().toISOString(),
          confirmedBy: profile?.email || user?.email || 'Operator',
          driverCount: Object.keys(tags).length
        });
      } catch (e) {
        console.warn("Error saving manifest to Firestore:", e);
      }
    }
  };

  const saveMultiDayManifests = async (batchData: Record<string, Record<number, string>>) => {
    setManifests(prev => {
      const next = { ...prev };
      Object.entries(batchData).forEach(([dt, tags]) => {
        next[dt] = { ...(next[dt] || {}), ...tags };
      });
      return next;
    });

    setDrivers(prev => {
      const copy = [...prev];
      Object.entries(batchData).forEach(([dt, tags]) => {
        Object.entries(tags).forEach(([idxStr, tag]) => {
          const idx = Number(idxStr);
          if (copy[idx]) {
            copy[idx] = {
              ...copy[idx],
              history: { ...(copy[idx].history || {}), [dt]: tag }
            };
          }
        });
      });
      return copy;
    });

    if (user || profile) {
      for (const [dt, tags] of Object.entries(batchData)) {
        try {
          await setDoc(doc(db, 'manifests', dt), {
            date: dt,
            tags,
            confirmedAt: new Date().toISOString(),
            confirmedBy: profile?.email || user?.email || 'Dispatcher',
            driverCount: Object.keys(tags).length
          });
        } catch (e) {
          console.warn("Error saving multi-day manifest to Firestore:", e);
        }
      }
    }
  };

  const addCashTransaction = async (txData: Omit<CashTransaction, 'id' | 'createdAt'>) => {
    const id = 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newTx: CashTransaction = {
      ...txData,
      id,
      createdAt: new Date().toISOString(),
      createdBy: profile?.email || user?.email || 'Cashier'
    };

    setCashTransactions(prev => [newTx, ...prev]);

    if (user || profile) {
      try {
        await setDoc(doc(db, 'cashbook', id), newTx);
      } catch (e) {
        console.warn("Error saving cash transaction to Firestore:", e);
      }
    }
  };

  const reverseCashTransaction = async (id: string, reason?: string) => {
    const original = cashTransactions.find(t => t.id === id);
    if (!original) return;

    const revId = 'REV-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const reversalTx: CashTransaction = {
      id: revId,
      date: new Date().toISOString().substring(0, 10),
      dateISO: new Date().toISOString().substring(0, 10),
      account: original.account,
      employee: original.employee,
      type: 'Reversal',
      category: original.category,
      amount: -original.amount,
      description: `Reversal of ${id}${reason ? ': ' + reason : ''}`,
      status: 'Posted',
      reversalOf: id,
      createdAt: new Date().toISOString(),
      createdBy: profile?.email || user?.email || 'Cashier'
    };

    setCashTransactions(prev => [
      reversalTx,
      ...prev.map(t => t.id === id ? { ...t, status: 'Reversed' as const } : t)
    ]);

    if (user || profile) {
      try {
        await setDoc(doc(db, 'cashbook', revId), reversalTx);
        await updateDoc(doc(db, 'cashbook', id), { status: 'Reversed' });
      } catch (e) {
        console.warn("Error reversing cash transaction in Firestore:", e);
      }
    }
  };

  const deleteCashTransaction = async (id: string) => {
    setCashTransactions(prev => prev.filter(t => t.id !== id));
    if (user || profile) {
      try {
        await deleteDoc(doc(db, 'cashbook', id));
      } catch (e) {
        console.warn("Error deleting cash transaction in Firestore:", e);
      }
    }
  };

  const addKmRecord = async (rec: Omit<KmRecord, 'id'>) => {
    const id = 'KM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newRec: KmRecord = {
      ...rec,
      id,
      loggedBy: profile?.email || user?.email || 'Dispatcher'
    };

    setKmRecords(prev => {
      // Check if existing record for date and vehicle
      const existingIdx = prev.findIndex(r => r.date === rec.date && r.veh.toUpperCase().replace(/\s+/g,'') === rec.veh.toUpperCase().replace(/\s+/g,''));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...newRec, id: copy[existingIdx].id };
        return copy;
      }
      return [newRec, ...prev];
    });

    if (user || profile) {
      try {
        await setDoc(doc(db, 'km_records', id), newRec);
      } catch (e) {
        console.warn("Error saving KM record in Firestore:", e);
      }
    }
  };

  const deleteKmRecord = async (id: string) => {
    setKmRecords(prev => prev.filter(r => r.id !== id));
    if (user || profile) {
      try {
        await deleteDoc(doc(db, 'km_records', id));
      } catch (e) {
        console.warn("Error deleting KM record in Firestore:", e);
      }
    }
  };

  const addDieselLog = async (logData: Omit<DieselLog, 'id'>) => {
    const id = 'DSL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const newLog: DieselLog = {
      ...logData,
      id,
      loggedBy: profile?.email || user?.email || 'Cashier'
    };
    setDieselLogs(prev => [newLog, ...prev]);

    if (user || profile) {
      try {
        await setDoc(doc(db, 'diesel_logs', id), newLog);
      } catch (e) {
        console.warn("Error saving diesel log to Firestore:", e);
      }
    }
  };

  const resolveConflict = async (conflictId: string, note?: string) => {
    setConflicts(prev => prev.map(c => c.id === conflictId ? { ...c, status: 'resolved' as const, issue: note ? `${c.issue} (Resolved: ${note})` : c.issue } : c));
  };

  const learnHistoricalRules = (rules: LearnedRule[]) => {
    setLearnedRules(prev => [...prev, ...rules]);
  };

  const restoreFullBackup = async (data: any): Promise<{ success: boolean; message: string }> => {
    try {
      if (!data) return { success: false, message: "No data payload provided" };

      if (Array.isArray(data.trucks) && data.trucks.length > 0) {
        setTrucks(data.trucks);
      }
      if (Array.isArray(data.equipment) && data.equipment.length > 0) {
        setEquipment(data.equipment);
      }
      if (Array.isArray(data.drivers) && data.drivers.length > 0) {
        setDrivers(data.drivers);
      }
      if (data.manifests && typeof data.manifests === 'object') {
        setManifests(data.manifests);
      }
      if (data.schedules && typeof data.schedules === 'object') {
        setSchedules(data.schedules);
      }
      if (data.cashbook?.transactions && Array.isArray(data.cashbook.transactions)) {
        setCashTransactions(data.cashbook.transactions);
      }
      if (Array.isArray(data.km) || Array.isArray(data.kmRecords)) {
        setKmRecords(data.km || data.kmRecords);
      }
      if (Array.isArray(data.diesel) || Array.isArray(data.dieselLogs)) {
        setDieselLogs(data.diesel || data.dieselLogs);
      }
      if (Array.isArray(data.dataQuality)) {
        setConflicts(data.dataQuality);
      }

      return {
        success: true,
        message: `Restored successfully: ${data.trucks?.length || 0} Trucks, ${data.drivers?.length || 0} Drivers, ${data.equipment?.length || 0} Equipment records!`
      };
    } catch (err: any) {
      return { success: false, message: `Restore error: ${err.message}` };
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
          dieselLogs: dieselLogs.length
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
      kmRecords,
      dieselLogs,
      dataQuality: conflicts,
      learnedRules
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TLS_LMS_Master_Backup_${new Date().toISOString().substring(0, 10)}.json`;
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
    saveDailyManifest,
    saveMultiDayManifests,
    addCashTransaction,
    reverseCashTransaction,
    deleteCashTransaction,
    addKmRecord,
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
