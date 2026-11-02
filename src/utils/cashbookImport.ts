import type { CashAccount, CashTransaction } from '../types';
import { isValidISODate } from './dateUtils';

export function parseCashbookReplacement(rows: Record<string, unknown>[], accounts: CashAccount[]): CashTransaction[] {
  if (!rows.length) throw new Error('CSV has no transactions.');
  const seen = new Set<string>();
  const types = ['Advance Given','Expense Settlement','Advance Returned','Cash In','Cash Out','Income','Transfer In','Transfer Out'];
  return rows.map((source,index) => {
    const row = Object.fromEntries(Object.entries(source).map(([key,value]) => [key.replace(/^\uFEFF/, '').trim(), value]));
    const get = (key: string) => String(row[key] ?? '').trim();
    const id = get('ID');
    if (!id || id.includes('/') || seen.has(id)) throw new Error(`Row ${index+2}: missing, invalid or duplicate ID.`);
    seen.add(id);
    let date = get('Date');
    const match = /^(\d{2})-(\d{2})-(\d{2}|\d{4})$/.exec(date);
    if (match) date = `${match[3].length===2 ? '20'+match[3] : match[3]}-${match[2]}-${match[1]}`;
    if (!isValidISODate(date)) throw new Error(`Row ${index+2}: invalid date.`);
    const rawAmount=get('Amount').replace(/,/g,'');
    const amount = Number(rawAmount);
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || !Number.isFinite(amount) || amount < 0) throw new Error(`Row ${index+2}: invalid amount.`);
    const type = get('Type');
    if (!types.includes(type) || get('Status') !== 'Posted') throw new Error(`Row ${index+2}: unsupported type/status. Replacement CSV must contain posted entries only.`);
    const matches = accounts.filter(account => account.name.trim().toLowerCase()===get('Account').toLowerCase());
    if (matches.length!==1) throw new Error(`Row ${index+2}: account "${get('Account')}" is missing or ambiguous. Resolve accounts first.`);
    if (['Advance Given','Expense Settlement','Advance Returned'].includes(type) && !get('Employee')) throw new Error(`Row ${index+2}: employee is required.`);
    return {id,date,dateISO:date,employee:get('Employee'),account:matches[0].name,accountId:matches[0].id,
      type:type as CashTransaction['type'],category:get('Category'),amount,description:get('Description'),status:'Posted'};
  });
}

export function cashbookReplacementSummary(rows: CashTransaction[]) {
  const cents = (type: string) => rows.filter(row => row.type===type).reduce((sum,row)=>sum+Math.round(row.amount*100),0);
  const employees: Record<string,number>={};
  rows.forEach(row => {
    if (!row.employee) return;
    const sign = row.type==='Advance Given' ? 1 : ['Expense Settlement','Advance Returned'].includes(row.type) ? -1 : 0;
    employees[row.employee]=(employees[row.employee]||0)+sign*Math.round(row.amount*100);
  });
  return {count:rows.length,advances:cents('Advance Given')/100,settlements:cents('Expense Settlement')/100,returned:cents('Advance Returned')/100,
    outstanding:Object.values(employees).reduce((sum,value)=>sum+Math.max(0,value),0)/100,
    employeeNet:Object.values(employees).reduce((sum,value)=>sum+value,0)/100};
}
