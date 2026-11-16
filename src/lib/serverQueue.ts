import { Transaction } from './types';

// In-memory queue for incoming webhook transactions when Supabase is not yet connected
interface QueuedItem {
  transaction: Transaction;
  queuedAt: number;
  synced: boolean;
}

// Global server singleton to survive hot-reloads during local dev
declare global {
  // eslint-disable-next-line no-var
  var __MONEY_FLOW_QUEUE__: QueuedItem[] | undefined;
  // eslint-disable-next-line no-var
  var __MONEY_FLOW_SERVER_SNAPSHOT__: any | undefined;
}

if (!global.__MONEY_FLOW_QUEUE__) {
  global.__MONEY_FLOW_QUEUE__ = [];
}

export function queueWebhookTransaction(txn: Transaction) {
  if (!global.__MONEY_FLOW_QUEUE__) global.__MONEY_FLOW_QUEUE__ = [];
  global.__MONEY_FLOW_QUEUE__.push({
    transaction: txn,
    queuedAt: Date.now(),
    synced: false,
  });
}

export function getUnsyncedTransactions(): Transaction[] {
  if (!global.__MONEY_FLOW_QUEUE__) return [];
  const unsynced = global.__MONEY_FLOW_QUEUE__.filter((item) => !item.synced).map((i) => i.transaction);
  return unsynced;
}

export function markTransactionsSynced(txnIds: string[]) {
  if (!global.__MONEY_FLOW_QUEUE__) return;
  global.__MONEY_FLOW_QUEUE__.forEach((item) => {
    if (txnIds.includes(item.transaction.id)) {
      item.synced = true;
    }
  });
}

export function setServerSnapshot(snapshot: any) {
  global.__MONEY_FLOW_SERVER_SNAPSHOT__ = snapshot;
}

export function getServerSnapshot(): any {
  return global.__MONEY_FLOW_SERVER_SNAPSHOT__ || null;
}
