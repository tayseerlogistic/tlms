import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCashbookReplacement,cashbookReplacementSummary} from '../src/utils/cashbookImport';
const accounts=[{id:'account',name:'Cash TLS',opening:500,active:true}];
const source=(patch:Record<string,unknown>={})=>({ID:'CB-1',Date:'02-11-26',Employee:'A',Account:'Cash TLS',Type:'Advance Given',Category:'Advance',Amount:'100.25',Description:'',Status:'Posted',...patch});
test('CSV replacement converts DD-MM-YY dates and retains original IDs and decimal amounts',()=>{
 const [r]=parseCashbookReplacement([source()],accounts);
 assert.equal(r.dateISO,'2026-11-02');assert.equal(r.id,'CB-1');assert.equal(r.amount,100.25);assert.equal(r.accountId,'account');
 assert.equal(accounts[0].opening,500);
});
test('replacement rejects duplicate IDs, bad dates, missing accounts, amounts and inactive statuses',()=>{
 for(const rows of [[source(),source()],[source({Date:'31-02-26'})],[source({Account:'Unknown'})],[source({Amount:''})],[source({Amount:'NaN'})],[source({Status:'Deleted'})]]){
  assert.throws(()=>parseCashbookReplacement(rows,accounts));
 }
});
test('reconciliation separates positive employee debt from employee credit balances',()=>{
 const rows=parseCashbookReplacement([source({ID:'1',Employee:'A',Amount:'100'}),source({ID:'2',Employee:'A',Type:'Expense Settlement',Amount:'80'}),source({ID:'3',Employee:'B',Type:'Expense Settlement',Amount:'5'})],accounts);
 const summary=cashbookReplacementSummary(rows);
 assert.equal(summary.outstanding,20);assert.equal(summary.employeeNet,15);
});
test('UTF-8 BOM and spaces in CSV headers do not hide the transaction ID',()=>{
 const row=source();delete (row as Record<string,unknown>).ID;
 const [result]=parseCashbookReplacement([{...row,'\uFEFFID':'CB-1'}],accounts);
 assert.equal(result.id,'CB-1');
});
