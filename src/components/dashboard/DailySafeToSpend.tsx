'use client';

import React, { useState } from 'react';
import {
  Flame,
  ShieldCheck,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { db } from '@/lib/db';

interface DailySafeToSpendProps {
  monthlyBudget: number;
  fixedRecurringBills: number;
  totalSpentThisMonth: number;
  spentToday: number;
  onBudgetUpdated: () => void;
}

export const DailySafeToSpend = React.memo(function DailySafeToSpend({
  monthlyBudget = 25000,
  fixedRecurringBills = 8000,
  totalSpentThisMonth = 0,
  spentToday = 0,
  onBudgetUpdated,
}: DailySafeToSpendProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [tempBudget, setTempBudget] = useState(monthlyBudget.toString());
  const [tempFixed, setTempFixed] = useState(fixedRecurringBills.toString());

  // Date Calculations
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1); // including today

  // Safe to Spend Formula:
  // (Monthly Budget - Fixed Recurring Bills - Total Spent So Far) / Days Remaining
  const netDiscretionaryPool = Math.max(0, monthlyBudget - fixedRecurringBills - totalSpentThisMonth);
  const dailySafeLimit = Math.max(0, Math.round(netDiscretionaryPool / daysRemaining));
  const remainingToday = dailySafeLimit - spentToday;
  const isOverspentToday = remainingToday < 0;

  // Percentage of today's limit used
  const percentToday = dailySafeLimit > 0 ? Math.min(100, Math.round((spentToday / dailySafeLimit) * 100)) : 100;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(tempBudget);
    const f = parseFloat(tempFixed);
    if (!isNaN(b) && !isNaN(f)) {
      await db.app_settings.update('global', {
        monthlyBudget: b,
        fixedRecurringBills: f,
      });
      setShowConfig(false);
      onBudgetUpdated();
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] space-y-3.5 sm:space-y-4 flex flex-col justify-between h-full min-w-0 w-full overflow-hidden">
      {/* Top Banner */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${
                isOverspentToday
                  ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'
                  : percentToday > 75
                  ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400'
              }`}
            >
              {isOverspentToday ? (
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              ) : percentToday > 75 ? (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 truncate">
                  Safe-to-Spend
                </h2>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-semibold border border-slate-200 dark:border-slate-700 shrink-0">
                  {daysRemaining}d left
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 truncate">
                Protects {formatINR(fixedRecurringBills)} bills
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors shrink-0"
            title="Configure Budget & Fixed Bills"
            aria-label="Configure Budget"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Config Panel Dropdown */}
        {showConfig && (
          <form
            onSubmit={handleSaveConfig}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 space-y-3 animate-fade-in mb-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200">Adjust Safe-to-Spend Target</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Formula parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Monthly Budget (₹)</label>
                <input
                  type="number"
                  value={tempBudget}
                  onChange={(e) => setTempBudget(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Fixed Bills / Rent (₹)</label>
                <input
                  type="number"
                  value={tempFixed}
                  onChange={(e) => setTempFixed(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* 3 Metrics: Today's Limit, Spent Today, Remaining Today */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-1 min-w-0">
          {/* Today's Limit */}
          <div className="p-2 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block truncate">
              Today&apos;s Limit
            </span>
            <p className="text-xs sm:text-base md:text-lg font-black font-mono text-slate-900 dark:text-slate-200 tabular-nums mt-0.5 truncate">
              {formatINR(dailySafeLimit)}
            </p>
          </div>

          {/* Spent Today */}
          <div className="p-2 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-center min-w-0 overflow-hidden">
            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 block truncate">
              Spent Today
            </span>
            <p className="text-xs sm:text-base md:text-lg font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums mt-0.5 truncate">
              {formatINR(spentToday)}
            </p>
          </div>

          {/* Remaining Today */}
          <div
            className={`p-2 sm:p-3 rounded-xl border text-center min-w-0 overflow-hidden ${
              isOverspentToday
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
            }`}
          >
            <span
              className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider block truncate ${
                isOverspentToday ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isOverspentToday ? 'Over Limit' : 'Left Today'}
            </span>
            <p
              className={`text-xs sm:text-base md:text-lg font-black font-mono tabular-nums mt-0.5 truncate ${
                isOverspentToday ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {isOverspentToday ? `-${formatINR(Math.abs(remainingToday))}` : formatINR(remainingToday)}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-1.5 pt-1 min-w-0">
        <div className="w-full h-2 sm:h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverspentToday
                ? 'bg-rose-500'
                : percentToday > 75
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${Math.min(100, percentToday)}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400 min-w-0">
          <span className="shrink-0">{percentToday}% burned today</span>
          <span className="truncate text-right">
            {isOverspentToday ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold truncate">Exceeded safe pace</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                On pace for {formatINR(netDiscretionaryPool)}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
});
