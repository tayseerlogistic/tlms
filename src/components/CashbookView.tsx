import React, { useState } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { CashTransaction } from '../types';
import * as XLSX from 'xlsx';
import {
  Wallet, DollarSign, Plus, Download, Printer, Search,
  RotateCcw, Trash2, ArrowUpRight, ArrowDownRight, User,
  CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

export const CashbookView: React.FC = () => {
  const { cashTransactions, cashAccounts, drivers, addCashTransaction, reverseCashTransaction, deleteCashTransaction } = useLms();
  const { isCashier, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Statement view state
  const [statementEmployee, setStatementEmployee] = useState<string | null>(null);

  // Compute Account Balances
  const accountBalances: Record<string, number> = {};
  cashAccounts.forEach(a => { accountBalances[a.name] = a.opening; });

  let totalInflow = 0;
  let totalOutflow = 0;

  cashTransactions.forEach(t => {
    if (t.status === 'Reversed') return;
    const isInf = ['Cash In', 'Income', 'Transfer In', 'Advance Returned'].includes(t.type);
    const isOut = ['Advance Given', 'Transfer Out', 'Cash Out', 'Expense Settlement'].includes(t.type);

    if (isInf) {
      totalInflow += t.amount;
      accountBalances[t.account] = (accountBalances[t.account] || 0) + t.amount;
    }
    if (isOut) {
      totalOutflow += t.amount;
      accountBalances[t.account] = (accountBalances[t.account] || 0) - t.amount;
    }
  });

  const totalCash = Object.values(accountBalances).reduce((a, b) => a + b, 0);

  // Outstanding Employee Advances
  const employeeBalances: Record<string, number> = {};
  cashTransactions.forEach(t => {
    if (t.status === 'Reversed' || !t.employee) return;
    if (t.type === 'Advance Given') {
      employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) + t.amount;
    }
    if (t.type === 'Expense Settlement' || t.type === 'Advance Returned') {
      employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) - t.amount;
    }
  });

  const totalOutstandingAdvances = Object.values(employeeBalances).reduce((a, b) => a + Math.max(0, b), 0);

  // Filter transactions
  const filtered = cashTransactions.filter(t => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = !s || t.id.toLowerCase().includes(s) || (t.employee && t.employee.toLowerCase().includes(s)) || (t.description && t.description.toLowerCase().includes(s));
    const matchesType = !filterType || t.type === filterType;
    const matchesAccount = !filterAccount || t.account === filterAccount;
    return matchesSearch && matchesType && matchesAccount;
  });

  const handleCreateTx = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const type = fd.get('type') as any;
    const amount = parseFloat(fd.get('amount') as string);
    const employee = (fd.get('employee') as string) || '';

    if (['Advance Given', 'Expense Settlement', 'Advance Returned'].includes(type) && !employee) {
      alert("Employee is required for Advances and Settlements.");
      return;
    }

    await addCashTransaction({
      date: (fd.get('date') as string) || new Date().toISOString().substring(0, 10),
      dateISO: (fd.get('date') as string) || new Date().toISOString().substring(0, 10),
      account: fd.get('account') as string,
      type,
      employee,
      category: (fd.get('category') as string) || 'General',
      amount,
      description: (fd.get('description') as string) || '',
      receipt: (fd.get('receipt') as string) || '',
      status: 'Posted'
    });

    setIsModalOpen(false);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(t => ({
      'Tx ID': t.id,
      Date: t.dateISO,
      Employee: t.employee || '—',
      Account: t.account,
      Type: t.type,
      Category: t.category,
      Amount: t.amount,
      Description: t.description,
      Status: t.status,
      'Created By': t.createdBy || 'Staff'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cashbook_Ledger');
    XLSX.writeFile(wb, `TLS_Cashbook_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" /> Cashbook Pro &bull; Driver Advances &amp; Petty Cash
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time cash flow, trip per diem settlements, and double-entry driver float ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          {(isCashier || isAdmin) && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> New Cash Transaction
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Total Cash in Hand</span>
          <h3 className="text-2xl font-black text-white font-mono mt-1">SAR {totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-400 mt-1">Across all active accounts</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Outstanding Advances</span>
          <h3 className="text-2xl font-black text-amber-400 font-mono mt-1">SAR {totalOutstandingAdvances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-400 mt-1">Driver floats awaiting settlement</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Total Inflows</span>
          <h3 className="text-2xl font-black text-emerald-400 font-mono mt-1">+SAR {totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-400 mt-1">Cash In &amp; returned advances</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Total Outflows</span>
          <h3 className="text-2xl font-black text-rose-400 font-mono mt-1">-SAR {totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          <p className="text-xs text-slate-400 mt-1">Advances &amp; verified expenses</p>
        </div>
      </div>

      {/* Account Balances Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cashAccounts.map(a => (
          <div key={a.id} className="bg-slate-800/90 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold">{a.name}</span>
              <div className="text-lg font-bold text-white font-mono mt-0.5">
                SAR {(accountBalances[a.name] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <span className="text-[10px] font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-300">
              Opening: {a.opening}
            </span>
          </div>
        ))}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-sm">Ledger Entries ({filtered.length})</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tx ID, driver, note..."
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="Advance Given">Advance Given</option>
              <option value="Expense Settlement">Expense Settlement</option>
              <option value="Advance Returned">Advance Returned</option>
              <option value="Cash In">Cash In</option>
              <option value="Cash Out">Cash Out</option>
              <option value="Transfer In">Transfer In</option>
              <option value="Transfer Out">Transfer Out</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Employee / Driver</th>
                <th className="p-3">Account</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Amount (SAR)</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(t => {
                const isInf = ['Cash In', 'Income', 'Transfer In', 'Advance Returned'].includes(t.type);
                return (
                  <tr key={t.id} className="hover:bg-slate-800/60 transition">
                    <td className="p-3 font-mono font-bold text-slate-300">{t.id}</td>
                    <td className="p-3 font-mono text-slate-400">{t.dateISO}</td>
                    <td className="p-3 font-semibold text-white">
                      {t.employee ? (
                        <button
                          onClick={() => setStatementEmployee(t.employee)}
                          className="hover:underline text-blue-400 text-left font-semibold"
                        >
                          {t.employee}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-slate-300">{t.account}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.type === 'Advance Given' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        t.type === 'Expense Settlement' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                        isInf ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{t.category}</td>
                    <td className={`p-3 text-right font-mono font-bold text-sm ${isInf ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isInf ? '+' : '-'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{t.description || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        t.status === 'Posted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {(isCashier || isAdmin) && t.status !== 'Reversed' && t.type !== 'Reversal' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              const reason = prompt("Enter reversal reason:");
                              if (reason !== null) reverseCashTransaction(t.id, reason);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-400"
                            title="Reverse transaction"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (confirm(`Permanently delete transaction ${t.id}?`)) deleteCashTransaction(t.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-400"
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

      {/* Modal: New Cash Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">New Cashbook Transaction</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateTx} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Date *</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().substring(0, 10)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Account *</label>
                  <select
                    name="account"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Type *</label>
                  <select
                    name="type"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Advance Given">Advance Given (Float Out)</option>
                    <option value="Expense Settlement">Expense Settlement (Verified Receipt)</option>
                    <option value="Advance Returned">Advance Returned (Float In)</option>
                    <option value="Cash In">Cash In (Funding)</option>
                    <option value="Cash Out">Cash Out (General)</option>
                    <option value="Transfer In">Transfer In</option>
                    <option value="Transfer Out">Transfer Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Amount (SAR) *</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Employee / Driver</label>
                <select
                  name="employee"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Non-employee / General —</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.empNo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Category</label>
                <select
                  name="category"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="Diesel & Fuel">Diesel &amp; Fuel</option>
                  <option value="Highway Tolls & Port">Highway Tolls &amp; Port Fees</option>
                  <option value="Meals & Per Diem">Meals &amp; Per Diem</option>
                  <option value="Vehicle Maintenance">Vehicle Maintenance</option>
                  <option value="Tires & Spares">Tires &amp; Spares</option>
                  <option value="Fines & Penalties">Fines &amp; Penalties</option>
                  <option value="General Advance">General Trip Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Trip route, waybill, or invoice details..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Employee Statement */}
      {statementEmployee && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Employee Ledger Statement</h3>
                <p className="text-xs text-blue-400 font-semibold">{statementEmployee}</p>
              </div>
              <button onClick={() => setStatementEmployee(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">Current Net Outstanding Balance:</span>
              <span className="text-lg font-black font-mono text-amber-400">
                SAR {(employeeBalances[statementEmployee] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 font-mono">Transaction History</h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                {cashTransactions
                  .filter(t => t.employee === statementEmployee && t.status !== 'Reversed')
                  .map(t => (
                    <div key={t.id} className="p-3 bg-slate-900/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-slate-400 text-[10px]">{t.dateISO} &bull; {t.id}</div>
                        <div className="font-semibold text-white mt-0.5">{t.type} ({t.category})</div>
                        <div className="text-slate-400 text-[11px]">{t.description}</div>
                      </div>
                      <div className={`font-mono font-bold text-sm ${t.type === 'Advance Given' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {t.type === 'Advance Given' ? '+' : '-'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
