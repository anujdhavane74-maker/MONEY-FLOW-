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
}

export const SummaryCards = React.memo(function SummaryCards({
  currentBalance,
  totalIncome,
  totalExpense,
  totalSavings,
}: SummaryCardsProps) {
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalSavings + Math.max(0, currentBalance)) / totalIncome) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 h-full">
      {/* 1. Current Balance Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 dark:shadow-none flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Net Balance
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p
            className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
              currentBalance >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatINR(currentBalance)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span>Available cash flow</span>
          </div>
        </div>
      </div>

      {/* 2. Total Income Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 dark:shadow-none flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Income
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatINR(totalIncome)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600/90 dark:text-emerald-400/80 font-medium">
            <ArrowUpRight className="w-3 h-3" />
            <span>Credited this month</span>
          </div>
        </div>
      </div>

      {/* 3. Total Spent Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 dark:shadow-none flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Spent
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
            {formatINR(totalExpense)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-rose-600/90 dark:text-rose-400/80 font-medium">
            <ArrowDownRight className="w-3 h-3" />
            <span>Outflow this month</span>
          </div>
        </div>
      </div>

      {/* 4. Total Saved Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm shadow-slate-900/5 dark:shadow-none flex flex-col justify-between relative overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Saved
          </span>
          <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-cyan-600 dark:text-cyan-400 tabular-nums">
            {formatINR(totalSavings)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-cyan-600/90 dark:text-cyan-400/80 font-medium">
            <Sparkles className="w-3 h-3" />
            <span>{savingsRate}% savings rate</span>
          </div>
        </div>
      </div>
    </div>
  );
});
