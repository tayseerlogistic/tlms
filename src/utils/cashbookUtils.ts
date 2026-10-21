import { CashTransaction } from '../types';

const CASH_IN_TYPES: CashTransaction['type'][] = ['Cash In', 'Income', 'Transfer In', 'Advance Returned'];
const CASH_OUT_TYPES: CashTransaction['type'][] = ['Advance Given', 'Transfer Out', 'Cash Out', 'Expense Settlement'];

export function hasCompensatingReversal(transaction: CashTransaction, allTransactions: CashTransaction[]): boolean {
  return allTransactions.some(item => item.type === 'Reversal' && item.reversalOf === transaction.id);
}

/** Signed effect on account balance. Positive adds cash; negative reduces cash. */
export function transactionCashImpact(transaction: CashTransaction, allTransactions: CashTransaction[]): number {
  // A reversed original remains in the ledger when its compensating reversal is present.
  // Older data can contain a Reversed status without its reversal entry; exclude that orphan.
  if (transaction.status === 'Reversed' && !hasCompensatingReversal(transaction, allTransactions)) return 0;
  const amount = Math.abs(Number(transaction.amount) || 0);
  if (transaction.type === 'Reversal') {
    const originalType = transaction.reversedType || allTransactions.find(item => item.id === transaction.reversalOf)?.type;
    if (originalType && CASH_IN_TYPES.includes(originalType)) return -amount;
    if (originalType && CASH_OUT_TYPES.includes(originalType)) return amount;
    return Number(transaction.amount) || 0;
  }
  if (CASH_IN_TYPES.includes(transaction.type)) return amount;
  if (CASH_OUT_TYPES.includes(transaction.type)) return -amount;
  return 0;
}

/** Signed effect on an employee's outstanding advance balance. Positive means the employee owes more. */
export function transactionEmployeeAdvanceImpact(transaction: CashTransaction, allTransactions: CashTransaction[]): number {
  if (transaction.status === 'Reversed' && !hasCompensatingReversal(transaction, allTransactions)) return 0;
  if (transaction.type === 'Advance Given') return Math.abs(Number(transaction.amount) || 0);
  if (transaction.type === 'Expense Settlement' || transaction.type === 'Advance Returned') return -Math.abs(Number(transaction.amount) || 0);
  if (transaction.type === 'Reversal') {
    const originalType = transaction.reversedType || allTransactions.find(item => item.id === transaction.reversalOf)?.type;
    if (originalType === 'Advance Given') return -Math.abs(Number(transaction.amount) || 0);
    if (originalType === 'Expense Settlement' || originalType === 'Advance Returned') return Math.abs(Number(transaction.amount) || 0);
  }
  return 0;
}
