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

export function SummaryCards({
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Current Balance Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-lg relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Net Balance
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p
            className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
              currentBalance >= 0 ? 'text-slate-100' : 'text-rose-400'
            }`}
          >
            {formatINR(currentBalance)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Available cash flow</span>
          </div>
        </div>
        {/* Subtle decorative glow */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
      </div>

      {/* 2. Total Income Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Income
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
            {formatINR(totalIncome)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400/80">
            <ArrowUpRight className="w-3 h-3" />
            <span>Credited this month</span>
          </div>
        </div>
      </div>

      {/* 3. Total Spent Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Spent
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-400 tabular-nums">
            {formatINR(totalExpense)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-rose-400/80">
            <ArrowDownRight className="w-3 h-3" />
            <span>Outflow this month</span>
          </div>
        </div>
      </div>

      {/* 4. Total Saved Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Saved
          </span>
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-cyan-400 tabular-nums">
            {formatINR(totalSavings)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-cyan-400/80">
            <Sparkles className="w-3 h-3" />
            <span>{savingsRate}% savings rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
