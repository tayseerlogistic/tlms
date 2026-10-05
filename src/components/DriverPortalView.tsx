import React, { useState } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import {
  Truck, Navigation, CheckCircle2, DollarSign, Gauge,
  Clock, MapPin, Send, AlertCircle, Phone
} from 'lucide-react';

export const DriverPortalView: React.FC = () => {
  const { drivers, trucks, equipment, manifests, schedules, cashTransactions, saveDailyManifest, addKmRecord } = useLms();
  const { user, profile, isAdmin, selectedDriverId, setSelectedDriverId } = useAuth();

  // Find current driver profile
  // If user has a linked driverId, use it; otherwise allow selection
  const currentDriver = drivers.find(d =>
    (selectedDriverId && d.id === selectedDriverId) ||
    (profile?.driverId && d.id === profile.driverId) ||
    (user?.email && d.name.toLowerCase().includes(user.email.split('@')[0].toLowerCase()))
  ) || drivers[0];

  const today = new Date().toISOString().substring(0, 10);
  const driverIdx = drivers.findIndex(d => d.id === currentDriver.id);
  const currentTag = (manifests[today] && manifests[today][driverIdx]) || 'At Yanbu Base';

  // Find assigned truck
  const assignedTruck = trucks.find(t => t.assignedDriverId === currentDriver.id || t.plate === currentDriver.assignedVehiclePlate);
  const assignedEquip = equipment.find(e => e.assignedTruckId === assignedTruck?.id);

  // Meter reading state
  const [odoInput, setOdoInput] = useState('');
  const [isSubmittingOdo, setIsSubmittingOdo] = useState(false);

  // Cash advance total for this driver
  let advanceBalance = 0;
  cashTransactions.forEach(t => {
    if (t.status === 'Reversed' || !t.employee) return;
    if (t.employee.toLowerCase() === currentDriver.name.toLowerCase()) {
      if (t.type === 'Advance Given') advanceBalance += t.amount;
      if (['Expense Settlement', 'Advance Returned'].includes(t.type)) advanceBalance -= t.amount;
    }
  });

  const handleUpdateTripStage = async (newStage: string) => {
    const updatedTag = `${newStage} - ${assignedTruck?.plate || 'Fleet'}`;
    await saveDailyManifest(today, { [driverIdx]: updatedTag });
    alert(`Status updated to: ${newStage}`);
  };

  const handleOdometerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(odoInput);
    if (isNaN(val) || val <= 0) return alert("Enter valid odometer reading");

    setIsSubmittingOdo(true);
    try {
      await addKmRecord({
        date: today,
        veh: assignedTruck?.plate || currentDriver.assignedVehiclePlate || 'Truck',
        odometer: val,
        km: 0,
        driver: currentDriver.name,
        notes: 'Submitted via Driver Mobile Portal'
      });
      alert(`Odometer reading ${val.toLocaleString()} KM submitted successfully!`);
      setOdoInput('');
    } finally {
      setIsSubmittingOdo(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Driver Switcher (For Admins / Testers) */}
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-300 font-mono">Mobile Driver Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Driver View:</span>
          <select
            value={currentDriver.id}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.empNo})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver Identity Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {currentDriver.workingFor || 'TLS Fleet Operations'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-2">{currentDriver.name}</h2>
            <div className="flex items-center gap-3 text-xs text-slate-300 font-mono mt-1">
              <span>Emp: <strong className="text-blue-400">{currentDriver.empNo}</strong></span>
              <span>Iqama: <strong className="text-slate-200">{currentDriver.iqama || 'Active'}</strong></span>
              <span>Nat: <strong className="text-slate-200">{currentDriver.nationality}</strong></span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl text-blue-400">
            👤
          </div>
        </div>

        {/* Assigned Vehicle & Trailer */}
        <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-700/60">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">Assigned Truck Head</span>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {assignedTruck?.plate || currentDriver.assignedVehiclePlate || 'Standby'}
            </div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">Attached Trailer / Tanker</span>
            <div className="text-base font-bold text-sky-400 font-mono mt-0.5">
              {assignedEquip?.equipNo || '214SLF19'}
            </div>
          </div>
        </div>
      </div>

      {/* Active Trip & One-Tap Status Updater */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-400" /> Today's Trip Status
          </h3>
          <span className="text-xs font-mono text-slate-400">{today}</span>
        </div>

        <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex flex-col gap-1">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Current Manifest Status:</span>
          <span className="text-sm font-bold text-white font-mono">{currentTag}</span>
        </div>

        {/* 1-Tap Quick Action Progression Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-2">Update Stage on the Road:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleUpdateTripStage('Under Loading at Yanbu')}
              className="p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition"
            >
              <div className="text-xs font-bold text-amber-300">1. Under Loading</div>
              <div className="text-[10px] text-slate-400">At refinery / plant</div>
            </button>
            <button
              onClick={() => handleUpdateTripStage('On the way to Destination')}
              className="p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition"
            >
              <div className="text-xs font-bold text-blue-400">2. On Highway / Transit</div>
              <div className="text-[10px] text-slate-400">En route to customer</div>
            </button>
            <button
              onClick={() => handleUpdateTripStage('Under Offloading at Destination')}
              className="p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition"
            >
              <div className="text-xs font-bold text-purple-400">3. Under Offloading</div>
              <div className="text-[10px] text-slate-400">At customer site</div>
            </button>
            <button
              onClick={() => handleUpdateTripStage('Coming Back to Yanbu Base')}
              className="p-3 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition"
            >
              <div className="text-xs font-bold text-emerald-400">4. Coming Back / Arrived</div>
              <div className="text-[10px] text-slate-400">Return journey to base</div>
            </button>
          </div>
        </div>
      </div>

      {/* Meter Reading Submission */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <Gauge className="w-4 h-4 text-emerald-400" /> Daily Odometer Submission
        </h3>
        <p className="text-xs text-slate-400">Enter the exact meter reading shown on your truck dashboard.</p>

        <form onSubmit={handleOdometerSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={odoInput}
              onChange={(e) => setOdoInput(e.target.value)}
              placeholder="e.g. 156420"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-lg font-bold font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 placeholder-slate-600"
            />
            <span className="absolute right-4 top-4 text-xs font-bold font-mono text-slate-500">KM</span>
          </div>
          <button
            type="submit"
            disabled={isSubmittingOdo}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Submit Dashboard Reading
          </button>
        </form>
      </div>

      {/* Driver Petty Cash & Advance Balance */}
      <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-3xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" /> Cash Advance &amp; Float Balance
          </h3>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
            SAR {advanceBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Remaining trip float in your possession. Settle by submitting diesel, meal, and highway toll receipts to the cashier.
        </p>
      </div>
    </div>
  );
};
