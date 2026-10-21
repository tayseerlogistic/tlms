import React, { useState } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { CashTransaction } from '../types';
import { ksaDateISO, isValidISODate } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  Wallet, DollarSign, Plus, Download, Printer, Search,
  RotateCcw, Trash2, ArrowUpRight, ArrowDownRight, User,
  CheckCircle2, AlertCircle, FileText, Users, Building2
} from 'lucide-react';

const CASH_IN_TYPES: CashTransaction['type'][] = ['Cash In', 'Income', 'Transfer In', 'Advance Returned'];
const CASH_OUT_TYPES: CashTransaction['type'][] = ['Advance Given', 'Transfer Out', 'Cash Out', 'Expense Settlement'];

function transactionCashImpact(tx: CashTransaction, allTransactions: CashTransaction[]): number {
  if (tx.status === 'Reversed') return 0;
  const amount = Math.abs(Number(tx.amount) || 0);
  if (tx.type === 'Reversal') {
    const originalType = tx.reversedType || allTransactions.find(item => item.id === tx.reversalOf)?.type;
    if (originalType && CASH_IN_TYPES.includes(originalType)) return -amount;
    if (originalType && CASH_OUT_TYPES.includes(originalType)) return amount;
    return Number(tx.amount) || 0;
  }
  if (CASH_IN_TYPES.includes(tx.type)) return amount;
  if (CASH_OUT_TYPES.includes(tx.type)) return -amount;
  return 0;
}

export const CashbookView: React.FC = () => {
  const { cashTransactions, cashAccounts, cashEmployees, drivers, addCashTransaction, addCashAccount, deleteCashAccount, addCashEmployee, deleteCashEmployee, reverseCashTransaction, deleteCashTransaction } = useLms();
  const { isCashier, isAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('Cash In');
  const [transactionAccount, setTransactionAccount] = useState('');
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [showEmployeeManager, setShowEmployeeManager] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const employeeNames = cashEmployees.map(employee => employee.name);
  const [accountName, setAccountName] = useState('');
  const [accountOpening, setAccountOpening] = useState('0');
  const [accountError, setAccountError] = useState('');
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfEmployeeFilter, setPdfEmployeeFilter] = useState('');
  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [pdfError, setPdfError] = useState('');

  // Statement view state
  const [statementEmployee, setStatementEmployee] = useState<string | null>(null);

  // Compute Account Balances
  const accountBalances: Record<string, number> = {};
  cashAccounts.forEach(a => { accountBalances[a.name] = a.opening; });

  let totalInflow = 0;
  let totalOutflow = 0;

  cashTransactions.forEach(t => {
    const impact = transactionCashImpact(t, cashTransactions);
    if (impact > 0) totalInflow += impact;
    if (impact < 0) totalOutflow += Math.abs(impact);
    if (impact !== 0) accountBalances[t.account] = (accountBalances[t.account] || 0) + impact;
  });

  const totalCash = Object.values(accountBalances).reduce((a, b) => a + b, 0);

  // Outstanding Employee Advances
  const employeeBalances: Record<string, number> = {};
  cashTransactions.forEach(t => {
    if (t.status === 'Reversed' || !t.employee) return;
    if (t.type === 'Reversal') {
      const originalType = t.reversedType || cashTransactions.find(item => item.id === t.reversalOf)?.type;
      if (originalType === 'Advance Given') employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) - Math.abs(t.amount);
      if (originalType === 'Expense Settlement' || originalType === 'Advance Returned') employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) + Math.abs(t.amount);
      return;
    }
    if (t.type === 'Advance Given') employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) + t.amount;
    if (t.type === 'Expense Settlement' || t.type === 'Advance Returned') employeeBalances[t.employee] = (employeeBalances[t.employee] || 0) - t.amount;
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

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid transaction amount greater than zero.');
      return;
    }
    try {
      await addCashTransaction({
        date: (fd.get('date') as string) || ksaDateISO(),
        dateISO: (fd.get('date') as string) || ksaDateISO(),
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
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to save transaction. Check your connection and permissions.');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newEmployeeName.trim();
    if (!name) return;
    if (employeeNames.some(existing => existing.toLowerCase() === name.toLowerCase()) || drivers.some(driver => driver.name.toLowerCase() === name.toLowerCase())) {
      alert('This employee already exists in the Cashbook directory or fleet driver list.');
      return;
    }
    try {
      await addCashEmployee(name);
      setNewEmployeeName('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to add employee. Please check your access and try again.');
    }
  };

  const handleRemoveEmployee = async (id: string, name: string) => {
    if (cashTransactions.some(t => t.employee === name && t.status !== 'Reversed')) {
      const ok = confirm(`“${name}” has transactions in the ledger. Remove them from the employee picker? Historical transactions will remain.`);
      if (!ok) return;
    }
    try {
      await deleteCashEmployee(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to remove employee. Please check your access and try again.');
    }
  };

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAccountError('');
    const name = accountName.trim();
    const opening = Number(accountOpening);
    if (!name || !Number.isFinite(opening) || opening < 0) {
      setAccountError('Enter an account name and a valid non-negative opening balance.');
      return;
    }
    if (cashAccounts.some(account => account.name.toLowerCase() === name.toLowerCase())) {
      setAccountError('An account with this name already exists.');
      return;
    }
    try {
      await addCashAccount({ name, opening, active: true });
      setAccountName('');
      setAccountOpening('0');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Unable to create account. Check your connection and permissions.');
    }
  };

  const handleRemoveAccount = async (id: string, name: string) => {
    if (cashTransactions.some(t => t.account === name)) {
      alert('This account has ledger history and cannot be removed safely. Keep it for reporting and create a new account instead.');
      return;
    }
    if (confirm(`Delete account “${name}”?`)) {
      try {
        await deleteCashAccount(id);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to remove account. Check your connection and permissions.');
      }
    }
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
    XLSX.writeFile(wb, `TLS_Cashbook_${ksaDateISO()}.xlsx`);
  };

  const exportPDF = () => {
    const employeeFilter = pdfEmployeeFilter.trim().toLowerCase();
    const fromDate = pdfFromDate.trim();
    const toDate = pdfToDate.trim();
    if (fromDate && !isValidISODate(fromDate)) { setPdfError('Enter a valid start date in YYYY-MM-DD format.'); return; }
    if (toDate && !isValidISODate(toDate)) { setPdfError('Enter a valid end date in YYYY-MM-DD format.'); return; }
    if (fromDate && toDate && fromDate > toDate) { setPdfError('The start date must be on or before the end date.'); return; }

    const reportRows = filtered
      .filter(t => (!employeeFilter || (t.employee || '').toLowerCase().includes(employeeFilter)) &&
        (!fromDate || (t.dateISO || t.date) >= fromDate) &&
        (!toDate || (t.dateISO || t.date) <= toDate))
      .slice()
      .sort((a, b) => (a.dateISO || a.date).localeCompare(b.dateISO || b.date));

    if (!reportRows.length) { setPdfError('No cashbook transactions match these report filters. Adjust the filters and try again.'); return; }
    setPdfError('');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setFontSize(16);
    pdf.text('Tayseer Logistics - Cashbook Report', 14, 15);
    pdf.setFontSize(9);
    pdf.text('Current ledger filters are applied. Account: ' + (filterAccount || 'All accounts') + ' | Employee: ' + (employeeFilter || 'All employees'), 14, 22);
    pdf.text('Period: ' + (fromDate || 'Beginning') + ' to ' + (toDate || 'Today') + ' | Rows: ' + reportRows.length, 14, 28);
    const headers = ['Date', 'Employee', 'Account', 'Type', 'Category', 'Amount (SAR)', 'Description', 'Status'];
    const widths = [24, 34, 32, 30, 28, 27, 75, 24];
    let y = 36;
    const drawHeader = () => {
      let x = 14;
      pdf.setFont('helvetica', 'bold');
      headers.forEach((header, index) => { pdf.text(header, x, y); x += widths[index]; });
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.line(14, y - 3, 288, y - 3);
    };
    drawHeader();
    reportRows.forEach(tx => {
      const cells = [tx.dateISO || tx.date, tx.employee || '—', tx.account, tx.type, tx.category, Number(tx.amount).toFixed(2), tx.description || '', tx.status];
      const wrapped = cells.map((value, index) => pdf.splitTextToSize(String(value), widths[index] - 2));
      const rowHeight = Math.max(6, ...wrapped.map(lines => lines.length * 4));
      if (y + rowHeight > 190) { pdf.addPage(); y = 15; drawHeader(); }
      let x = 14;
      wrapped.forEach((lines, index) => { pdf.text(lines, x, y); x += widths[index]; });
      y += rowHeight + 2;
    });
    const netTotal = reportRows.reduce((sum, tx) => sum + transactionCashImpact(tx, cashTransactions), 0);
    if (y > 185) { pdf.addPage(); y = 20; }
    pdf.setFont('helvetica', 'bold');
    pdf.text('Signed net of listed transactions (excluding reversed): SAR ' + netTotal.toFixed(2), 14, y + 4);
    pdf.save('TLS_Cashbook_Report_' + ksaDateISO() + '.pdf');
    setShowPdfOptions(false);
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
          <button
            onClick={() => { setPdfError(''); setShowPdfOptions(true); }}
            className="bg-rose-700 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-rose-600 flex items-center gap-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" /> Export PDF
          </button>
          {(isCashier || isAdmin) && (
            <button
              onClick={() => {
                setTransactionType('Cash In');
                setTransactionAccount(cashAccounts[0]?.name || '');
                setIsModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> New Cash Transaction
            </button>
          )}
        </div>
      </div>

      {(isCashier || isAdmin) && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm"><Building2 className="w-4 h-4 text-blue-400" /> Accounts</div>
            <button type="button" onClick={() => setShowAccountManager(v => !v)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700">
              {showAccountManager ? 'Close' : 'Open / Manage Accounts'}
            </button>
          </div>
          <p className="text-xs text-slate-300">Create a new account with an opening balance. Use Cash In / Cash Out transactions to add or remove funds with a dated ledger entry.</p>
          {showAccountManager && <form onSubmit={handleAddAccount} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-2">
            <input value={accountName} onChange={e => setAccountName(e.target.value)} required maxLength={80} placeholder="New account name" className="min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            <input value={accountOpening} onChange={e => setAccountOpening(e.target.value)} required type="number" min="0" step="0.01" aria-label="Opening balance SAR" placeholder="Opening balance" className="min-w-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
            <button type="submit" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">Create Account</button>
            {accountError && <p role="alert" className="sm:col-span-3 text-xs text-rose-300">{accountError}</p>}
            <div className="sm:col-span-3 space-y-1">
              {cashAccounts.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/80 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100 break-words">{account.name}</div>
                  <div className="text-slate-300">Opening balance: SAR {account.opening.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => { setTransactionAccount(account.name); setTransactionType('Cash In'); setIsModalOpen(true); }} className="rounded-md bg-emerald-700 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-600">+ Add Money</button>
                  <button type="button" onClick={() => { setTransactionAccount(account.name); setTransactionType('Cash Out'); setIsModalOpen(true); }} className="rounded-md bg-amber-700 px-2.5 py-1.5 font-bold text-white hover:bg-amber-600">− Remove Money</button>
                  {isAdmin && !['acc-001', 'acc-002', 'acc-003'].includes(account.id) && <button type="button" onClick={() => handleRemoveAccount(account.id, account.name)} className="rounded-md border border-rose-700 px-2.5 py-1.5 font-bold text-rose-300 hover:bg-rose-950" aria-label={`Delete ${account.name}`}>Delete</button>}
                </div>
              </div>)}
            </div>
          </form>}
        </section>
        <section className="rounded-2xl border border-slate-700 bg-slate-800/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm"><Users className="w-4 h-4 text-emerald-400" /> Cashbook Employees</div>
            <button type="button" onClick={() => setShowEmployeeManager(v => !v)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700">
              {showEmployeeManager ? 'Close' : 'Add / Remove Employees'}
            </button>
          </div>
          <p className="text-xs text-slate-300">Manage the employee list used by new Cashbook transactions. Removing an employee keeps their historical ledger entries intact.</p>
          {showEmployeeManager && <>
            <form onSubmit={handleAddEmployee} className="flex flex-col sm:flex-row gap-2">
              <input value={newEmployeeName} onChange={e => setNewEmployeeName(e.target.value)} required maxLength={120} placeholder="Employee full name" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" />
              <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">Add Employee</button>
            </form>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {cashEmployees.map(employee => <div key={employee.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/80 px-3 py-2 text-xs">
                <span className="text-slate-100">{employee.name}</span>
                <button type="button" onClick={() => handleRemoveEmployee(employee.id, employee.name)} className="text-rose-300 hover:text-rose-200">Remove</button>
              </div>)}
              {!cashEmployees.length && <p className="text-xs text-slate-400">No custom Cashbook employees yet. Fleet drivers remain available in the transaction picker.</p>}
            </div>
          </>}
        </section>
      </div>}

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
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="font-bold text-white text-sm">Ledger Entries ({filtered.length})</span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tx ID, driver, note..."
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-48 min-w-0"
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full min-w-0 p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">New Cashbook Transaction</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateTx} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Date *</label>
                  <input
                    name="date"
                    type="date"
                    defaultValue={ksaDateISO()}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 font-mono uppercase">Account *</label>
                  <select
                    name="account"
                    value={transactionAccount || cashAccounts[0]?.name || ''}
                    onChange={e => setTransactionAccount(e.target.value)}
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
                    value={transactionType}
                    onChange={e => setTransactionType(e.target.value)}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Advance Given">Advance Given (Float Out)</option>
                    <option value="Expense Settlement">Expense Settlement (Verified Receipt)</option>
                    <option value="Advance Returned">Advance Returned (Float In)</option>
                    <option value="Cash In">Add Money / Cash In (Funding)</option>
                    <option value="Cash Out">Remove Money / Cash Out (General)</option>
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
                  {Array.from(new Set([...employeeNames, ...drivers.map(d => d.name)])).sort().map(name => (
                    <option key={name} value={name}>{name}</option>
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

      {/* Modal: Cashbook PDF report filters */}
      {showPdfOptions && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-lg">Export Cashbook PDF</h3>
              <p className="text-xs text-slate-400 mt-1">The current ledger search, type, and account filters will be applied, together with the filters below.</p>
            </div>
            <label className="block text-xs text-slate-300 font-semibold">
              Employee contains
              <input value={pdfEmployeeFilter} onChange={e => setPdfEmployeeFilter(e.target.value)} placeholder="All employees" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs text-slate-300 font-semibold">
                From date
                <input type="date" value={pdfFromDate} max={pdfToDate || undefined} onChange={e => { setPdfFromDate(e.target.value); setPdfError(''); }} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </label>
              <label className="block text-xs text-slate-300 font-semibold">
                To date
                <input type="date" value={pdfToDate} min={pdfFromDate || undefined} onChange={e => { setPdfToDate(e.target.value); setPdfError(''); }} className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
              </label>
            </div>
            {pdfError && <p role="alert" className="text-xs text-rose-300 bg-rose-950/40 border border-rose-700/60 rounded-lg p-3">{pdfError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowPdfOptions(false); setPdfError(''); }} className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700">Cancel</button>
              <button onClick={exportPDF} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-600">Export PDF</button>
            </div>
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
