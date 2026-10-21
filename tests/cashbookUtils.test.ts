import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCompensatingReversal, transactionCashImpact, transactionEmployeeAdvanceImpact } from '../src/utils/cashbookUtils.ts';
import type { CashTransaction } from '../src/types/index.ts';

const tx = (data: Partial<CashTransaction> & Pick<CashTransaction, 'id' | 'type' | 'amount'>): CashTransaction => ({
  date: '2026-10-21', dateISO: '2026-10-21', account: 'Main Cash', category: 'Test', status: 'Posted',
  description: '', ...data
} as CashTransaction);

test('a compensating reversal offsets rather than replaces the original cash-in entry', () => {
  const original = tx({ id: 'cash-in-1', type: 'Cash In', amount: 100, status: 'Reversed' });
  const reversal = tx({ id: 'rev-1', type: 'Reversal', amount: 100, reversalOf: original.id, reversedType: original.type });
  const ledger = [original, reversal];
  assert.equal(hasCompensatingReversal(original, ledger), true);
  assert.equal(transactionCashImpact(original, ledger), 100);
  assert.equal(transactionCashImpact(reversal, ledger), -100);
  assert.equal(ledger.reduce((sum, item) => sum + transactionCashImpact(item, ledger), 0), 0);
});

test('a compensating reversal offsets an original cash-out entry', () => {
  const original = tx({ id: 'advance-1', type: 'Advance Given', amount: 75, status: 'Reversed' });
  const reversal = tx({ id: 'rev-2', type: 'Reversal', amount: 75, reversalOf: original.id, reversedType: original.type });
  const ledger = [original, reversal];
  assert.equal(transactionCashImpact(original, ledger), -75);
  assert.equal(transactionCashImpact(reversal, ledger), 75);
  assert.equal(ledger.reduce((sum, item) => sum + transactionCashImpact(item, ledger), 0), 0);
});

test('an orphaned historical Reversed transaction is excluded rather than counted twice', () => {
  const orphan = tx({ id: 'legacy-reversed', type: 'Cash In', amount: 50, status: 'Reversed' });
  assert.equal(hasCompensatingReversal(orphan, [orphan]), false);
  assert.equal(transactionCashImpact(orphan, [orphan]), 0);
});

test('employee advance balance is neutral when an advance is fully reversed', () => {
  const original = tx({ id: 'advance-2', type: 'Advance Given', amount: 125, employee: 'Driver A', status: 'Reversed' });
  const reversal = tx({ id: 'rev-3', type: 'Reversal', amount: 125, employee: 'Driver A', reversalOf: original.id, reversedType: original.type });
  const ledger = [original, reversal];
  assert.equal(ledger.reduce((sum, item) => sum + transactionEmployeeAdvanceImpact(item, ledger), 0), 0);
});
