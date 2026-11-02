import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeBalanceStatuses} from '../src/utils/employeeBalances';
import type {CashTransaction} from '../src/types';
const tx=(id:string,type:CashTransaction['type'],amount:number,employee='A',patch:Partial<CashTransaction>={})=>({
 id,type,amount,employee,date:'2026-11-02',dateISO:'2026-11-02',status:'Posted',...patch
}) as CashTransaction;

test('dashboard reconciles advances, settlements, returns, credits and zero-balance directory employees',()=>{
 const rows=employeeBalanceStatuses([
  tx('1','Advance Given',100),tx('2','Expense Settlement',70),tx('3','Advance Returned',10),
  tx('4','Expense Settlement',5,'B')
 ],[{name:'A'},{name:'No history'}]);
 const a=rows.find(row=>row.name==='A')!;
 assert.deepEqual([a.advances,a.settlements,a.returned,a.balance,a.status],[100,70,10,20,'owes-company']);
 assert.equal(rows.find(row=>row.name==='B')?.status,'company-owes');
 assert.equal(rows.find(row=>row.name==='No history')?.status,'settled');
 assert.equal(rows.length,3);
});
test('paired reversals neutralize category totals and orphan reversed entries do not create debt',()=>{
 const rows=employeeBalanceStatuses([
  tx('1','Advance Given',100,'A',{status:'Reversed'}),
  tx('2','Reversal',100,'A',{reversalOf:'1',reversedType:'Advance Given'}),
  tx('3','Expense Settlement',20,'B',{status:'Reversed'})
 ],[]);
 assert.equal(rows.find(row=>row.name==='A')?.advances,0);
 assert.equal(rows.find(row=>row.name==='A')?.balance,0);
 assert.equal(rows.find(row=>row.name==='B')?.settlements,0);
});
test('uses integer cents and keeps different employee identities separate',()=>{
 const rows=employeeBalanceStatuses([tx('1','Advance Given',0.1),tx('2','Advance Given',0.2),tx('3','Expense Settlement',0.3),tx('4','Advance Given',25,'A Khan')],[]);
 assert.equal(rows.find(row=>row.name==='A')?.balance,0);
 assert.equal(rows.find(row=>row.name==='A Khan')?.balance,25);
 assert.equal(rows[0].name,'A Khan');
});
