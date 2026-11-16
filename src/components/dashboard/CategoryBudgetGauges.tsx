'use client';

import React from 'react';
import {
  UtensilsCrossed,
  ShoppingBag,
  Car,
  GraduationCap,
  Home,
  Gamepad2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
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

export function CategoryBudgetGauges({ categories, transactions }: CategoryBudgetGaugesProps) {
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
    <div className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              Category Budgets & Pace
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700">
              Day {currentDay} of {daysInMonth} ({percentMonthElapsed}% of month)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time pace tracker compares spending speed against month progress
          </p>
        </div>
      </div>

      {/* Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
              className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {ICON_MAP[cat.icon] || <UtensilsCrossed className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-bold text-slate-200">{cat.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isOverBudget ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Over Budget
                    </span>
                  ) : isOverPace ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Fast Pace
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> On Track
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                  {/* Marker for current day of month */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10 opacity-70"
                    style={{ left: `${percentMonthElapsed}%` }}
                    title={`Day of month: ${percentMonthElapsed}%`}
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : isOverPace
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, percentSpent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-slate-200">{formatINR(spent)} spent</span>
                  <span className="text-slate-500">
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
}
