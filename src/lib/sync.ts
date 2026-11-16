import { db } from './db';
import { Transaction } from './types';

export interface SyncResult {
  success: boolean;
  newTransactions: Transaction[];
  timestamp: number;
  error?: string;
}

async function getClientApiKey(): Promise<string> {
  try {
    const settings = await db.app_settings.get('global');
    if (settings?.apiKey) return settings.apiKey;
  } catch (e) {
    // ignore
  }
  return '';
}

/**
 * Pull any incoming transactions ingested by MacroDroid via /api/ingest-sms
 */
export async function pullUnsyncedFromCloud(): Promise<Transaction[]> {
  try {
    const apiKey = await getClientApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch('/api/sync', {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.success || !Array.isArray(data.pendingTransactions) || data.pendingTransactions.length === 0) {
      return [];
    }

    const pending: Transaction[] = data.pendingTransactions;
    const newlyAdded: Transaction[] = [];

    for (const txn of pending) {
      const existing = await db.transactions.get(txn.id);
      if (!existing) {
        await db.transactions.add(txn);
        newlyAdded.push(txn);
      }
    }

    // Acknowledge receipt
    if (newlyAdded.length > 0) {
      const ids = newlyAdded.map((t) => t.id).join(',');
      await fetch(`/api/sync?ack=true&ids=${encodeURIComponent(ids)}`, {
        headers,
      });
    }

    return newlyAdded;
  } catch (err) {
    console.warn('Sync pull error:', err);
    return [];
  }
}

/**
 * Push current local state to cloud server so /share/[token] and backup reflect latest state
 */
export async function pushToCloud(): Promise<boolean> {
  try {
    const transactions = await db.transactions.toArray();
    const categories = await db.categories.toArray();
    const settings = await db.app_settings.get('global');
    const recurringBills = await db.recurring_bills.toArray();
    const ious = await db.ious.toArray();

    const apiKey = settings?.apiKey || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['X-API-Key'] = apiKey;

    const payload = {
      transactions,
      categories,
      parentShareTokens: settings?.parentShareTokens || [],
      settings: settings || {},
      recurringBills,
      ious,
    };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      localStorage.setItem('mf_last_cloud_sync', Date.now().toString());
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Sync push error:', err);
    return false;
  }
}

/**
 * Complete bidirectional sync
 */
export async function performFullSync(): Promise<SyncResult> {
  try {
    const newTxns = await pullUnsyncedFromCloud();
    const pushed = await pushToCloud();

    return {
      success: pushed,
      newTransactions: newTxns,
      timestamp: Date.now(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Full sync failed';
    return {
      success: false,
      newTransactions: [],
      timestamp: Date.now(),
      error: msg,
    };
  }
}
