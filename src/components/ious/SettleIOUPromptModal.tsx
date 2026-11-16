'use client';

import React from 'react';
import { CheckCircle2, X, UserCheck } from 'lucide-react';
import { IOU, Transaction } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { settleIOU } from '@/lib/db';

interface SettleIOUPromptModalProps {
  matchingIOU: IOU | null;
  incomingTxn: Transaction | null;
  onClose: () => void;
  onSettled: () => void;
}

export function SettleIOUPromptModal({
  matchingIOU,
  incomingTxn,
  onClose,
  onSettled,
}: SettleIOUPromptModalProps) {
  if (!matchingIOU || !incomingTxn) return null;

  const handleConfirmSettle = async () => {
    await settleIOU(matchingIOU.id, incomingTxn.id);
    onSettled();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Auto-Settlement Detected
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Settle Pending IOU?</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Incoming credit of <strong className="text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">{formatINR(incomingTxn.amount)}</strong>{' '}
            matches your pending shared expense.
          </p>
        </div>

        {/* Match Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Friend:</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{matchingIOU.personName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Owed For:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{matchingIOU.description}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700/50">
            <span className="text-slate-500 dark:text-slate-400">Amount to Settle:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
              {formatINR(matchingIOU.amount)}
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={handleConfirmSettle}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Yes, Settle IOU
          </button>
        </div>
      </div>
    </div>
  );
}
