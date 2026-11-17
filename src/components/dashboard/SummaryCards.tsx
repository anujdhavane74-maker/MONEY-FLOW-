'use client';

import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

interface SummaryCardsProps {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  onOpenReconcile?: () => void;
}

export const SummaryCards = React.memo(function SummaryCards({
  currentBalance,
  totalIncome,
  totalExpense,
  totalSavings,
  onOpenReconcile,
}: SummaryCardsProps) {
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalSavings + Math.max(0, currentBalance)) / totalIncome) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 h-full min-w-0 w-full">
      {/* 1. Current Balance Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
              Net Balance
            </span>
            {onOpenReconcile && (
              <button
                type="button"
                onClick={onOpenReconcile}
                className="px-1.5 py-0.5 rounded-md bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/80 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 text-[9px] font-bold transition-colors shrink-0"
                title="Reconcile with actual bank balance"
              >
                ⚖️ Reconcile
              </button>
            )}
          </div>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <p
            className={`text-lg sm:text-2xl font-bold font-mono tracking-tight tabular-nums truncate ${
              currentBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatINR(currentBalance)}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
            <span className="truncate">Available cash</span>
          </div>
        </div>
      </div>

      {/* 2. Total Income Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
            Income
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            {formatINR(totalIncome)}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600/90 dark:text-emerald-400/80 font-medium truncate">
            <ArrowUpRight className="w-3 h-3 shrink-0" />
            <span className="truncate">This month</span>
          </div>
        </div>
      </div>

      {/* 3. Total Spent Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
            Spent
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums truncate">
            {formatINR(totalExpense)}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-rose-600/90 dark:text-rose-400/80 font-medium truncate">
            <ArrowDownRight className="w-3 h-3 shrink-0" />
            <span className="truncate">Outflow</span>
          </div>
        </div>
      </div>

      {/* 4. Total Saved Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate">
            Saved
          </span>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <PiggyBank className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-cyan-600 dark:text-cyan-400 tabular-nums truncate">
            {formatINR(totalSavings)}
          </p>
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-cyan-600/90 dark:text-cyan-400/80 font-medium truncate">
            <Sparkles className="w-3 h-3 shrink-0" />
            <span className="truncate">{savingsRate}% rate</span>
          </div>
        </div>
      </div>
    </div>
  );
});
