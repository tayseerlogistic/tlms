import React, { useState } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { Truck, Equipment, Driver } from '../types';
import {
  Truck as TruckIcon, Users, Layers, AlertTriangle, Plus, Search,
  Edit2, Trash2, CheckCircle, X, ShieldAlert
} from 'lucide-react';

export const MasterDataView: React.FC = () => {
  const { trucks, equipment, drivers, conflicts, saveTruck, deleteTruck, saveEquipment, deleteEquipment, saveDriver, deleteDriver, resolveConflict } = useLms();
  const { isAdmin, isDispatcher } = useAuth();

  const [activeTab, setActiveTab] = useState<'trucks' | 'equipment' | 'drivers' | 'conflicts'>('trucks');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);

  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);

  // Filter lists
  const filteredTrucks = trucks.filter(t =>
    t.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.assignedDriverName && t.assignedDriverName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredDrivers = drivers.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.empNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.iqama.includes(searchTerm) ||
    d.mobile.includes(searchTerm)
  );

  const filteredEquipment = equipment.filter(e =>
    e.equipNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form Handlers
  const handleSaveTruck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const plate = (formData.get('plate') as string).trim().toUpperCase();
    const assignedDriverId = formData.get('driverId') as string;
    const selectedDriver = drivers.find(d => d.id === assignedDriverId);

    const truckToSave: Truck = {
      id: editingTruck ? editingTruck.id : `trk-${Date.now().toString(36)}`,
      seq: editingTruck ? editingTruck.seq : trucks.length + 1,
      plate,
      plateNorm: plate.replace(/\s+/g, ''),
      type: 'Truck',
      description: (formData.get('description') as string) || 'Fleet Truck',
      status: (formData.get('status') as any) || 'ACTIVE',
      istemaraExp: (formData.get('istemaraExp') as string) || '2026-12-31',
      insuranceExp: (formData.get('insuranceExp') as string) || '2026-12-31',
      fahasExp: (formData.get('fahasExp') as string) || '2026-12-31',
      assignedDriverId: assignedDriverId || null,
      assignedDriverName: selectedDriver ? selectedDriver.name : null,
      notes: (formData.get('notes') as string) || ''
    };

    await saveTruck(truckToSave);
    setIsTruckModalOpen(false);
    setEditingTruck(null);
  };

  const handleSaveDriver = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = (formData.get('name') as string).trim().toUpperCase();
    const empNo = (formData.get('empNo') as string).trim();
    const iqama = (formData.get('iqama') as string).trim();
    const mobile = (formData.get('mobile') as string).trim();

    const driverToSave: Driver = {
      id: editingDriver ? editingDriver.id : `drv-${Date.now().toString(36)}`,
      seq: editingDriver ? editingDriver.seq : drivers.length + 1,
      name,
      nameNorm: name,
      empNo: empNo || `L-EMP${String(drivers.length + 1).padStart(4, '0')}`,
      iqama: iqama || '',
      nationality: (formData.get('nationality') as string) || 'PAKISTAN',
      mobile: mobile || '',
      transporter: (formData.get('transporter') as string) || 'TLS',
      workingFor: (formData.get('workingFor') as string) || 'KSA - Local Supplies',
      status: (formData.get('status') as any) || 'AVAILABLE',
      active: true,
      notes: (formData.get('notes') as string) || ''
    };

    await saveDriver(driverToSave);
    setIsDriverModalOpen(false);
    setEditingDriver(null);
  };

  const handleSaveEquip = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const equipNo = (formData.get('equipNo') as string).trim().toUpperCase();
    const type = (formData.get('type') as any) || 'Tanker';

    const equipToSave: Equipment = {
      id: editingEquip ? editingEquip.id : `eq-${Date.now().toString(36)}`,
      seq: editingEquip ? editingEquip.seq : equipment.length + 1,
      equipNo,
      equipNorm: equipNo.replace(/\s+/g, ''),
      type,
      status: (formData.get('status') as any) || 'ACTIVE',
      assignedTruckId: (formData.get('truckId') as string) || null,
      active: true
    };

    await saveEquipment(equipToSave);
    setIsEquipModalOpen(false);
    setEditingEquip(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-400" /> Central Master Data Repository
          </h2>
          <p className="text-xs text-slate-400 mt-1">Single source of truth for all 46 trucks, 94 equipment items, and 69 drivers</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search plate, name, emp#..."
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-56 sm:w-64 font-mono"
            />
          </div>

          {(isAdmin || isDispatcher) && (
            <button
              onClick={() => {
                if (activeTab === 'trucks') { setEditingTruck(null); setIsTruckModalOpen(true); }
                else if (activeTab === 'drivers') { setEditingDriver(null); setIsDriverModalOpen(true); }
                else if (activeTab === 'equipment') { setEditingEquip(null); setIsEquipModalOpen(true); }
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Plus className="w-4 h-4" /> Add {activeTab === 'trucks' ? 'Truck' : activeTab === 'drivers' ? 'Driver' : 'Equipment'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('trucks')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'trucks' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TruckIcon className="w-4 h-4" /> Trucks ({trucks.length})
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'equipment' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Equipment ({equipment.length})
        </button>
        <button
          onClick={() => setActiveTab('drivers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'drivers' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Drivers ({drivers.length})
        </button>
        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'conflicts' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Data Quality &amp; Conflicts ({conflicts.length})
        </button>
      </div>

      {/* Tab 1: Trucks */}
      {activeTab === 'trucks' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="p-3">Seq</th>
                  <th className="p-3">Plate No</th>
                  <th className="p-3">Assigned Driver</th>
                  <th className="p-3">Attached Equipment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Istemara Expiry</th>
                  <th className="p-3">Insurance</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTrucks.map((t) => {
                  const assignedEquip = equipment.find(e => e.assignedTruckId === t.id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/60 transition">
                      <td className="p-3 font-mono text-slate-400">#{t.seq}</td>
                      <td className="p-3 font-bold text-white font-mono text-sm">{t.plate}</td>
                      <td className="p-3 font-semibold text-slate-200">
                        {t.assignedDriverName || <span className="text-slate-500 italic">Unassigned</span>}
                      </td>
                      <td className="p-3 font-mono text-sky-400 font-semibold">{assignedEquip ? assignedEquip.equipNo : '—'}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{t.istemaraExp || '2026-12-31'}</td>
                      <td className="p-3 font-mono text-slate-300">{t.insuranceExp || '2026-12-31'}</td>
                      <td className="p-3 text-right">
                        {(isAdmin || isDispatcher) && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditingTruck(t); setIsTruckModalOpen(true); }}
                              className="text-blue-400 hover:text-blue-300 p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => { if (confirm(`Delete truck ${t.plate}?`)) deleteTruck(t.id); }}
                                className="text-rose-400 hover:text-rose-300 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Equipment */}
      {activeTab === 'equipment' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="p-3">Seq</th>
                  <th className="p-3">Equipment #</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Assigned Truck Head</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEquipment.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/60 transition">
                    <td className="p-3 font-mono text-slate-400">#{e.seq}</td>
                    <td className="p-3 font-bold text-white font-mono text-sm">{e.equipNo}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        e.type === 'Tanker' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                        e.type === 'Flatbed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-200">{e.assignedTruckPlate || '—'}</td>
                    <td className="p-3">
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                        {e.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {(isAdmin || isDispatcher) && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingEquip(e); setIsEquipModalOpen(true); }}
                            className="text-blue-400 hover:text-blue-300 p-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => { if (confirm(`Delete equipment ${e.equipNo}?`)) deleteEquipment(e.id); }}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Drivers */}
      {activeTab === 'drivers' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="p-3">SL</th>
                  <th className="p-3">Driver Name</th>
                  <th className="p-3">Employee #</th>
                  <th className="p-3">Iqama</th>
                  <th className="p-3">Nationality</th>
                  <th className="p-3">Mobile Contact</th>
                  <th className="p-3">Default Truck</th>
                  <th className="p-3">Working Unit</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/60 transition">
                    <td className="p-3 font-mono text-slate-400">#{d.seq}</td>
                    <td className="p-3 font-bold text-white text-sm">{d.name}</td>
                    <td className="p-3 font-mono text-blue-400 font-bold">{d.empNo || '—'}</td>
                    <td className="p-3 font-mono text-slate-300">
                      {d.iqama ? d.iqama : <span className="text-amber-400 font-semibold">Missing</span>}
                    </td>
                    <td className="p-3 text-slate-300">{d.nationality}</td>
                    <td className="p-3 font-mono text-slate-300">
                      {d.mobile ? d.mobile : <span className="text-amber-400 italic">None</span>}
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">{d.assignedVehiclePlate || '—'}</td>
                    <td className="p-3 text-slate-400">{d.workingFor}</td>
                    <td className="p-3 text-right">
                      {(isAdmin || isDispatcher) && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingDriver(d); setIsDriverModalOpen(true); }}
                            className="text-blue-400 hover:text-blue-300 p-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => { if (confirm(`Delete driver ${d.name}?`)) deleteDriver(d.id); }}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Conflicts & Data Quality */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" /> Data Quality Anomaly &amp; Conflict Inspector
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              The automated sanitizer detected {conflicts.length} anomalies across legacy driver assignments and odometer histories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  c.status === 'resolved'
                    ? 'bg-slate-800/40 border-slate-700/60 opacity-70'
                    : 'bg-slate-800/90 border-amber-500/40 shadow-lg'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      Entity: {c.entity.toUpperCase()} ({c.entityId})
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.status === 'resolved'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {c.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white mt-2">{c.issue}</p>
                  <p className="text-xs font-mono text-slate-400 mt-1">Field: {c.field} &bull; Value: {String(c.value)}</p>
                </div>

                <div className="pt-2 border-t border-slate-700 flex justify-end">
                  {c.status === 'open' ? (
                    <button
                      onClick={() => resolveConflict(c.id, "Verified & confirmed by operator")}
                      className="text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Resolved in master database
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Truck Add/Edit */}
      {isTruckModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">{editingTruck ? 'Edit Truck' : 'Add New Prime Mover'}</h3>
              <button onClick={() => setIsTruckModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveTruck} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Plate Number *</label>
                <input
                  name="plate"
                  defaultValue={editingTruck?.plate || ''}
                  required
                  placeholder="e.g. DJA 4827"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Assigned Driver</label>
                <select
                  name="driverId"
                  defaultValue={editingTruck?.assignedDriverId || ''}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.empNo})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Status</label>
                  <select
                    name="status"
                    defaultValue={editingTruck?.status || 'ACTIVE'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="STANDBY">STANDBY</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Istemara Expiry</label>
                  <input
                    name="istemaraExp"
                    type="date"
                    defaultValue={editingTruck?.istemaraExp || '2026-12-31'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTruckModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
                >
                  Save Truck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Driver Add/Edit */}
      {isDriverModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">{editingDriver ? 'Edit Driver Record' : 'Register New Driver'}</h3>
              <button onClick={() => setIsDriverModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveDriver} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Driver Full Name *</label>
                <input
                  name="name"
                  defaultValue={editingDriver?.name || ''}
                  required
                  placeholder="e.g. MUHAMMAD FAYYAZ AWAN"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Employee No</label>
                  <input
                    name="empNo"
                    defaultValue={editingDriver?.empNo || ''}
                    placeholder="L-EMP0024"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Iqama Number</label>
                  <input
                    name="iqama"
                    defaultValue={editingDriver?.iqama || ''}
                    placeholder="2326626773"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Mobile</label>
                  <input
                    name="mobile"
                    defaultValue={editingDriver?.mobile || ''}
                    placeholder="05XXXXXXXX"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Nationality</label>
                  <input
                    name="nationality"
                    defaultValue={editingDriver?.nationality || 'PAKISTAN'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDriverModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Equipment Add/Edit */}
      {isEquipModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">{editingEquip ? 'Edit Trailer / Equipment' : 'Add New Equipment'}</h3>
              <button onClick={() => setIsEquipModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveEquip} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Equipment Number *</label>
                <input
                  name="equipNo"
                  defaultValue={editingEquip?.equipNo || ''}
                  required
                  placeholder="e.g. 118HCL18 or 4004008"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Type</label>
                  <select
                    name="type"
                    defaultValue={editingEquip?.type || 'Tanker'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Tanker">Tanker</option>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Dumber">Dumper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Status</label>
                  <select
                    name="status"
                    defaultValue={editingEquip?.status || 'ACTIVE'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="STANDBY">STANDBY</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEquipModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
                >
                  Save Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
