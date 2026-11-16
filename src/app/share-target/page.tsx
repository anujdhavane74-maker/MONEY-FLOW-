'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseIndianFinancialSms } from '@/lib/smsParser';
import { db, initializeDatabase, predictCategory } from '@/lib/db';
import { formatINR } from '@/lib/formatters';

function ShareTargetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<'parsing' | 'success' | 'error'>('parsing');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function processSharedText() {
      const text = searchParams.get('text') || searchParams.get('title') || '';

      if (!text) {
        setStatus('error');
        setErrorMsg('No shared SMS or notification text found.');
        return;
      }

      await initializeDatabase();
      const parsed = parseIndianFinancialSms(text);

      if (!parsed.success || !parsed.amount) {
        setStatus('error');
        setErrorMsg(parsed.errorMessage || 'Could not parse financial transaction from shared text.');
        return;
      }

      const predictedCategory = (await predictCategory(parsed.merchant || '')) || 'Uncategorized';

      const newTxn = {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        amount: parsed.amount,
        type: parsed.type || 'expense',
        category: predictedCategory,
        merchant: parsed.merchant || 'Unknown Merchant',
        rawMerchant: text,
        upiRefId: parsed.upiRefId,
        timestamp: parsed.timestamp || Date.now(),
        source: 'sms' as const,
        bankOrApp: parsed.bankOrApp,
        notes: 'Captured via Share Target',
        isCategorized: false, // will prompt user
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.transactions.add(newTxn);
      setResult(newTxn);
      setStatus('success');

      // Forward to dashboard with prompt for this transaction
      setTimeout(() => {
        router.push(`/?prompt_txn=${newTxn.id}`);
      }, 1200);
    }

    processSharedText();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 text-center">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        {status === 'parsing' && (
          <>
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <h2 className="text-lg font-bold">Processing Shared Transaction...</h2>
            <p className="text-xs text-slate-400">Extracting amount, merchant, and UPI reference.</p>
          </>
        )}

        {status === 'success' && result && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Transaction Captured!</h2>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-left space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Merchant:</span>
                <span className="text-sm font-semibold text-white">{result.merchant}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Amount:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">{formatINR(result.amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Category:</span>
                <span className="text-xs text-cyan-300 font-medium">{result.category}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">Redirecting to categorize...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white">Capture Incomplete</h2>
            <p className="text-xs text-rose-300">{errorMsg}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Open Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading...
        </div>
      }
    >
      <ShareTargetContent />
    </Suspense>
  );
}
