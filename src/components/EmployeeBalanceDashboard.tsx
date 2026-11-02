import React,{useState} from 'react';
import * as XLSX from 'xlsx';
import type {EmployeeBalanceStatus} from '../utils/employeeBalances';
import {ksaDateISO} from '../utils/dateUtils';
const money=(value:number)=>value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const labels={'owes-company':'Owes company','company-owes':'Company owes employee',settled:'Fully settled'};
export function EmployeeBalanceDashboard({rows,onStatement}:{rows:EmployeeBalanceStatus[];onStatement:(name:string)=>void}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'all'|EmployeeBalanceStatus['status']>('all');
 const filtered=rows.filter(row=>(filter==='all'||row.status===filter)&&row.name.toLowerCase().includes(search.trim().toLowerCase()));
 const owed=rows.reduce((sum,row)=>sum+Math.max(0,Math.round(row.balance*100)),0)/100;
 const credit=rows.reduce((sum,row)=>sum+Math.max(0,-Math.round(row.balance*100)),0)/100;
 const exportEmployees=()=>{
  const sheet=XLSX.utils.json_to_sheet(filtered.map(row=>({
   Employee:row.name,'Advances Given (SAR)':row.advances,'Expenses Settled (SAR)':row.settlements,
   'Advances Returned (SAR)':row.returned,'Net Balance (SAR)':row.balance,Status:labels[row.status],
   'Last Transaction':row.lastDate,Transactions:row.transactionCount
  })));
  sheet['!cols']=[{wch:38},...Array.from({length:5},()=>({wch:25})),{wch:18},{wch:15}];
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Employee Balances');
  XLSX.writeFile(book,'Cashbook_Employee_Balances_'+ksaDateISO()+'.xlsx');
 };
 return <section id="cashbook-employee-status" className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h3 className="text-lg font-bold text-white">Employee balance dashboard</h3>
   <p className="text-xs text-slate-400 mt-1">All-time advances − settlements − returned cash. Updated from the shared ledger; similar names stay separate.</p></div>
   <button onClick={exportEmployees} disabled={!filtered.length} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-100 disabled:opacity-50">Export employee balances Excel</button>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
   <div className="rounded-xl border border-amber-700/60 bg-slate-800 p-3"><p className="text-xs text-slate-300">Employees owe company</p><strong className="text-xl text-amber-300">SAR {money(owed)}</strong><p className="text-xs text-slate-400">{rows.filter(row=>row.balance>0).length} employees holding advances</p></div>
   <div className="rounded-xl border border-emerald-700/60 bg-slate-800 p-3"><p className="text-xs text-slate-300">Company owes employees</p><strong className="text-xl text-emerald-300">SAR {money(credit)}</strong><p className="text-xs text-slate-400">{rows.filter(row=>row.balance<0).length} employees with credit balances</p></div>
   <div className="rounded-xl border border-slate-600 bg-slate-800 p-3"><p className="text-xs text-slate-300">Fully settled</p><strong className="text-xl text-white">{rows.filter(row=>row.balance===0).length} employees</strong><p className="text-xs text-slate-400">{rows.length} employees in directory or transaction history</p></div>
  </div>
  <div className="flex flex-col sm:flex-row gap-2">
   <input aria-label="Search employee balances" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search employee name…" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white" />
   <select aria-label="Employee balance status" value={filter} onChange={event=>setFilter(event.target.value as typeof filter)} className="rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white">
    <option value="all">All employees ({rows.length})</option><option value="owes-company">Owes company</option><option value="company-owes">Company owes employee</option><option value="settled">Fully settled</option>
   </select>
  </div>
  <p className="text-xs text-slate-400">{filtered.length} employees shown · Largest absolute balances first · Select a card for the statement</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
   {filtered.map(row=><button key={row.name} onClick={()=>onStatement(row.name)} className="min-w-0 text-left rounded-xl border border-slate-600 bg-slate-800 p-4 hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
    <h4 className="font-bold text-sm text-white break-words">{row.name}</h4>
    <p className={'text-xl font-bold my-2 '+(row.status==='owes-company'?'text-amber-300':row.status==='company-owes'?'text-emerald-300':'text-slate-200')}>SAR {money(Math.abs(row.balance))}</p>
    <p className="text-xs font-semibold text-slate-200">{labels[row.status]}</p>
    <dl className="mt-3 space-y-1 text-xs text-slate-300">
     <div className="flex justify-between gap-2"><dt>Advances</dt><dd>{money(row.advances)}</dd></div>
     <div className="flex justify-between gap-2"><dt>Settled expenses</dt><dd>{money(row.settlements)}</dd></div>
     <div className="flex justify-between gap-2"><dt>Cash returned</dt><dd>{money(row.returned)}</dd></div>
    </dl>
    <p className="text-[11px] text-slate-400 mt-3">{row.lastDate ? 'Last transaction: '+row.lastDate : 'No transactions yet'} · View statement →</p>
   </button>)}
  </div>
  {!filtered.length&&<p className="py-5 text-center text-sm text-slate-400">No employees match this search or status.</p>}
 </section>;
}
