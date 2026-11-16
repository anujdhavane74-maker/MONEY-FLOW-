import { Transaction, DeduplicationMatchResult, ImportSummary } from './types';
import { db, predictCategory } from './db';

/**
 * Intelligent Deduplication & Merge Engine
 *
 * Matching Rules:
 * 1. Exact Match: UPI Reference Number (UTR / Ref ID) if both or one has it and matches.
 * 2. Fuzzy Match: Amount is identical (within 1 paisa) AND Type is identical AND Timestamp is within ±5 minutes (300,000 ms).
 *
 * Merging Invariant:
 * - NEVER overwrite user-assigned categories or custom notes!
 * - Enrich existing record with official statement UPI Ref ID and metadata.
 */
export async function reconcileIncomingTransactions(
  incomingList: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<ImportSummary> {
  const existingTransactions = await db.transactions.toArray();
  const results: DeduplicationMatchResult[] = [];

  let mergedCount = 0;
  let newCount = 0;
  let skippedCount = 0;

  for (const incoming of incomingList) {
    let matchedExisting: Transaction | undefined;
    let matchType: 'exact_upi_id' | 'fuzzy_amount_time' | undefined;

    // 1. Exact Match by 12-digit UPI Reference ID / UTR
    if (incoming.upiRefId && incoming.upiRefId.length >= 6) {
      matchedExisting = existingTransactions.find(
        (ex) => ex.upiRefId && ex.upiRefId.trim() === incoming.upiRefId?.trim()
      );
      if (matchedExisting) {
        matchType = 'exact_upi_id';
      }
    }

    // 2. Fuzzy Match (if not matched by UPI ID)
    if (!matchedExisting) {
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      matchedExisting = existingTransactions.find((ex) => {
        const isSameAmount = Math.abs(ex.amount - incoming.amount) < 0.01;
        const isSameType = ex.type === incoming.type;
        const isWithinFiveMins = Math.abs(ex.timestamp - incoming.timestamp) <= FIVE_MINUTES_MS;

        return isSameAmount && isSameType && isWithinFiveMins;
      });

      if (matchedExisting) {
        matchType = 'fuzzy_amount_time';
      }
    }

    if (matchedExisting) {
      // Merge: Enrich without overwriting user category or notes
      const enrichedTransaction: Transaction = {
        ...matchedExisting,
        upiRefId: matchedExisting.upiRefId || incoming.upiRefId,
        bankOrApp: matchedExisting.bankOrApp || incoming.bankOrApp,
        rawMerchant: matchedExisting.rawMerchant || incoming.rawMerchant,
        updatedAt: Date.now(),
      };

      results.push({
        status: 'merged',
        transaction: enrichedTransaction,
        matchedBy: matchType,
        existingId: matchedExisting.id,
      });
      mergedCount++;
    } else {
      // Genuinely New Transaction
      // Try to auto-predict category
      const predictedCategory = (await predictCategory(incoming.merchant)) || incoming.category || 'Uncategorized';

      const newTxn: Transaction = {
        ...incoming,
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: predictedCategory,
        isCategorized: predictedCategory !== 'Uncategorized',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      results.push({
        status: 'inserted',
        transaction: newTxn,
      });
      newCount++;
    }
  }

  return {
    totalParsed: incomingList.length,
    mergedCount,
    newCount,
    skippedCount,
    transactions: results,
  };
}

/**
 * Commit the reconciled transactions into Dexie IndexedDB
 */
export async function commitReconciliation(results: DeduplicationMatchResult[]): Promise<{
  inserted: number;
  merged: number;
}> {
  let inserted = 0;
  let merged = 0;

  for (const item of results) {
    if (item.status === 'merged' && item.existingId) {
      await db.transactions.update(item.existingId, {
        upiRefId: item.transaction.upiRefId,
        bankOrApp: item.transaction.bankOrApp,
        rawMerchant: item.transaction.rawMerchant,
        updatedAt: Date.now(),
      });
      merged++;
    } else if (item.status === 'inserted') {
      await db.transactions.add(item.transaction);
      inserted++;
    }
  }

  return { inserted, merged };
}
