'use client';

import React, { memo } from 'react';
import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  GraduationCap,
  Home,
  Gamepad2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Category, Transaction } from '@/lib/types';
import { formatINR } from '@/lib/formatters';

interface CategoryBudgetGaugesProps {
  categories: Category[];
  transactions: Transaction[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
  UtensilsCrossed: <UtensilsCrossed className="w-3.5 h-3.5" />,
  ShoppingBag: <ShoppingBag className="w-3.5 h-3.5" />,
  Car: <Car className="w-3.5 h-3.5" />,
  GraduationCap: <GraduationCap className="w-3.5 h-3.5" />,
  Home: <Home className="w-3.5 h-3.5" />,
  Gamepad2: <Gamepad2 className="w-3.5 h-3.5" />,
};

export const CategoryBudgetGauges = memo(function CategoryBudgetGauges({
  categories,
  transactions,
}: CategoryBudgetGaugesProps) {
  // Current Month & Day calculation
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Percentage of month elapsed
  const percentMonthElapsed = Math.round((currentDay / daysInMonth) * 100);

  // Calculate spent per category this month
  const categorySpent: Record<string, number> = {};
  transactions
    .filter((t) => {
      const d = new Date(t.timestamp);
      return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .forEach((t) => {
      categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
    });

  // Pick top 4 categories with a budget
  const budgetedCategories = categories
    .filter((c) => c.type === 'expense' && c.budgetMonthly && c.budgetMonthly > 0)
    .slice(0, 4);

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-3.5 sm:space-y-4 transition-colors min-w-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 truncate">
              Budgets & Pace
            </h2>
            <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-200 dark:border-slate-700 tabular-nums shrink-0">
              Day {currentDay}/{daysInMonth} ({percentMonthElapsed}%)
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            Compares spending pace against calendar month progress
          </p>
        </div>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 min-w-0">
        {budgetedCategories.map((cat) => {
          const spent = categorySpent[cat.name] || 0;
          const budget = cat.budgetMonthly || 5000;
          const percentSpent = Math.round((spent / budget) * 100);
          const remaining = Math.max(0, budget - spent);

          // Overpace check: spending faster than month elapsed
          const isOverPace = percentSpent > percentMonthElapsed + 15;
          const isOverBudget = spent > budget;

          return (
            <div
              key={cat.id}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all space-y-2 min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {ICON_MAP[cat.icon] || <UtensilsCrossed className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isOverBudget ? (
                    <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 dark:bg-rose-950/60 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-bold flex items-center gap-0.5 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Over
                    </span>
                  ) : isOverPace ? (
                    <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 dark:bg-amber-950/60 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-0.5 shrink-0">
                      <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Fast
                    </span>
                  ) : (
                    <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-0.5 shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> On Track
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 min-w-0">
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                  {/* Marker for current day of month */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10 opacity-70"
                    style={{ left: `${percentMonthElapsed}%` }}
                    title={`Day of month: ${percentMonthElapsed}%`}
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : isOverPace
                        ? 'bg-amber-500 dark:bg-amber-400'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, percentSpent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono tabular-nums gap-1 min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate shrink-0">{formatINR(spent)} spent</span>
                  <span className="text-slate-500 dark:text-slate-500 truncate text-right">
                    {remaining > 0 ? `${formatINR(remaining)} left` : `₹0 left`} of {formatINR(budget)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
