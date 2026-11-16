'use client';

import React, { useState } from 'react';
import {
  MessageSquareText,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { parseIndianFinancialSms } from '@/lib/smsParser';
import { formatINR } from '@/lib/formatters';
import { db, predictCategory } from '@/lib/db';
import { triggerCategorizationNotification } from '@/lib/notification';
import { Transaction } from '@/lib/types';

interface QuickSmsPasteModalProps {
  onClose: () => void;
  onIngested: (txn: Transaction) => void;
}

const SAMPLE_TEMPLATES = [
  {
    label: 'BoM: Anand Vadapav (₹150)',
    text: 'Dear Customer, Your A/c XXXX1234 is debited by INR 150.00 on 16-Nov-26 by UPI Ref No 418291029182 to ANAND VADAPAV. Avail Bal: INR 12,450.00 - BoM',
  },
  {
    label: 'HDFC: Swiggy Biryani (₹349)',
    text: 'Sent Rs.349.00 from HDFC Bank A/C **1234 to SWIGGY on 16-11-26 via UPI. Ref 420192039485. Not you? Call 1800...',
  },
  {
    label: 'SBI: PMPML Bus Pass (₹45)',
    text: 'Dear SBI UPI User, A/C 9876 debited by 45.0 on 16Nov26 transfer to PMPML BUS Ref No 419201928312.',
  },
  {
    label: 'SBI: Pocket Money Credit (₹5,000)',
    text: 'Your A/C 9876 Credited by Rs 5,000.00 on 10Nov26 by UPI/PAPA/9823019283@okaxis/419201928311.',
  },
];

export function QuickSmsPasteModal({ onClose, onIngested }: QuickSmsPasteModalProps) {
  const [smsText, setSmsText] = useState('');
  const [error, setError] = useState('');

  const parsed = smsText.trim() ? parseIndianFinancialSms(smsText) : null;

  const handleIngest = async () => {
    if (!parsed || !parsed.success || !parsed.amount) {
      setError('Please provide or paste a valid bank transaction message.');
      return;
    }

    const predictedCat = (await predictCategory(parsed.merchant || '')) || 'Uncategorized';

    const newTxn: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: parsed.amount,
      type: parsed.type || 'expense',
      category: predictedCat,
      merchant: parsed.merchant || 'Unknown Merchant',
      rawMerchant: smsText,
      upiRefId: parsed.upiRefId,
      timestamp: parsed.timestamp || Date.now(),
      source: 'sms',
      bankOrApp: parsed.bankOrApp,
      notes: 'Ingested via SMS parser',
      isCategorized: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.transactions.add(newTxn);

    triggerCategorizationNotification({
      amount: newTxn.amount,
      merchant: newTxn.merchant,
      transactionId: newTxn.id,
    });

    onIngested(newTxn);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 text-slate-900 dark:text-slate-100 flex flex-col max-h-[90dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <MessageSquareText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Bank SMS Ingest</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Paste raw SMS to auto-extract transaction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Sample Fill Buttons */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
            Click to Test Sample Bank SMS:
          </span>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => {
                  setSmsText(tmpl.text);
                  setError('');
                }}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors truncate"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* SMS Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            Raw SMS / Notification Text:
          </label>
          <textarea
            rows={4}
            value={smsText}
            onChange={(e) => {
              setSmsText(e.target.value);
              setError('');
            }}
            placeholder="Paste your bank or UPI debit/credit message here..."
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
          />
        </div>

        {/* Live Regex Parser Preview Box */}
        {parsed && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 ${
              parsed.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-200'
                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800/50 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                {parsed.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Regex Parser Match
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    Parsing Error
                  </>
                )}
              </span>
              {parsed.success && parsed.amount && (
                <span className="font-black font-mono text-base text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {formatINR(parsed.amount)}
                </span>
              )}
            </div>

            {parsed.success ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200 dark:border-emerald-800/30">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Merchant: </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{parsed.merchant}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Type: </span>
                  <span className="capitalize font-semibold text-slate-900 dark:text-white">{parsed.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Bank / App: </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{parsed.bankOrApp}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">UPI Ref: </span>
                  <span className="font-mono text-slate-900 dark:text-white tabular-nums">{parsed.upiRefId || 'Not in text'}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px]">{parsed.errorMessage}</p>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={!parsed?.success}
          onClick={handleIngest}
          className="w-full py-3 min-h-[44px] rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-500 hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Capture & Open Categorize Prompt
        </button>
      </div>
    </div>
  );
}
