import type { CashTransaction } from '../types';
import {transactionEmployeeAdvanceImpact} from './cashbookUtils';
export interface EmployeeBalanceStatus {
 name:string; advances:number; settlements:number; returned:number; balance:number;
 status:'owes-company'|'company-owes'|'settled'; lastDate:string; transactionCount:number;
}

/** One projection of the ledger, in cents. Names are never guessed/merged by similarity. */
export function employeeBalanceStatuses(transactions:CashTransaction[],directory:{name:string}[]):EmployeeBalanceStatus[]{
 const employees=new Map<string,{name:string;advances:number;settlements:number;returned:number;balance:number;lastDate:string;transactionCount:number}>();
 const get=(name:string)=>{
  let employee=employees.get(name);
  if(!employee){employee={name,advances:0,settlements:0,returned:0,balance:0,lastDate:'',transactionCount:0};employees.set(name,employee);}
  return employee;
 };
 directory.forEach(employee=>{const name=employee.name.trim();if(name)get(name);});
 transactions.forEach(transaction=>{
  const name=String(transaction.employee||'').trim();if(!name)return;
  const employee=get(name);
  const impact=Math.round(transactionEmployeeAdvanceImpact(transaction,transactions)*100);
  const type=transaction.type==='Reversal' ? transaction.reversedType || transactions.find(row=>row.id===transaction.reversalOf)?.type : transaction.type;
  if(type==='Advance Given')employee.advances+=impact;
  if(type==='Expense Settlement')employee.settlements-=impact;
  if(type==='Advance Returned')employee.returned-=impact;
  employee.balance+=impact;
  employee.transactionCount++;
  const date=transaction.dateISO||transaction.date||'';
  if(date>employee.lastDate)employee.lastDate=date;
 });
 return [...employees.values()].map(employee=>({
  ...employee,advances:employee.advances/100,settlements:employee.settlements/100,returned:employee.returned/100,balance:employee.balance/100,
  status:employee.balance>0 ? 'owes-company' as const : employee.balance<0 ? 'company-owes' as const : 'settled' as const
 })).sort((a,b)=>Math.abs(b.balance)-Math.abs(a.balance)||a.name.localeCompare(b.name));
}
