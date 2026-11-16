'use client';

import React, { useState, useEffect, memo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { Transaction } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { useTheme } from '@/lib/theme';

interface FinancialChartsProps {
  transactions: Transaction[];
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  'Shopping': '#ec4899',
  'Travel & Transit': '#06b6d4',
  'Stationery & Education': '#8b5cf6',
  'Rent & Bills': '#ef4444',
  'Subscriptions & Gaming': '#a855f7',
  'Transfers': '#64748b',
  'Savings & Investments': '#10b981',
  'Other': '#94a3b8',
};

const FALLBACK_COLORS = [
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
];

export const FinancialCharts = memo(function FinancialCharts({ transactions }: FinancialChartsProps) {
  const [mounted, setMounted] = useState(false);
  const [chartView, setChartView] = useState<'donut' | 'cashflow'>('donut');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 rounded-3xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
        Loading visualizations...
      </div>
    );
  }

  // 1. Prepare Category Donut Data (Expenses this month)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthExpenses = transactions.filter((t) => {
    const d = new Date(t.timestamp);
    return t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const catMap: Record<string, number> = {};
  currentMonthExpenses.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const donutData = Object.entries(catMap)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const totalExpenseVal = donutData.reduce((sum, d) => sum + d.value, 0);

  // 2. Prepare Cash Flow Data (Last 7 Days)
  const dayBuckets: Record<string, { dayLabel: string; income: number; expense: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    dayBuckets[key] = { dayLabel, income: 0, expense: 0 };
  }

  transactions.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = d.toISOString().slice(0, 10);
    if (dayBuckets[key]) {
      if (t.type === 'income') {
        dayBuckets[key].income += t.amount;
      } else if (t.type === 'expense') {
        dayBuckets[key].expense += t.amount;
      }
    }
  });

  const cashFlowData = Object.values(dayBuckets);

  const isDark = resolvedTheme === 'dark';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const cellStroke = isDark ? '#090d16' : '#ffffff';

  // Custom Donut Tooltip
  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = totalExpenseVal > 0 ? ((data.value / totalExpenseVal) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-2.5 rounded-xl shadow-xl text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-200">{data.name}</p>
          <p className="text-emerald-600 dark:text-emerald-400 font-bold font-mono tabular-nums mt-0.5">{formatINR(data.value)}</p>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5 tabular-nums">{pct}% of monthly spend</p>
        </div>
      );
    }
    return null;
  };

  // Custom Cashflow Tooltip
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-300">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={`item-${index}`}
              className="font-mono tabular-nums text-xs font-medium"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatINR(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-3 sm:space-y-4 transition-colors min-w-0 w-full overflow-hidden">
      {/* Header with Switcher */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 truncate">
            {chartView === 'donut' ? 'Spending by Category' : '7-Day Cash Flow'}
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {chartView === 'donut'
              ? 'Where money flows this month'
              : 'Income vs. Expense daily'}
          </p>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            type="button"
            onClick={() => setChartView('donut')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              chartView === 'donut'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <PieIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Category</span>
          </button>
          <button
            type="button"
            onClick={() => setChartView('cashflow')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              chartView === 'cashflow'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flow</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-64 w-full min-w-0 overflow-hidden">
        {chartView === 'donut' ? (
          donutData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
              <PieIcon className="w-8 h-8 mb-2 opacity-30" />
              <span>No expense transactions logged this month</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center h-full gap-2 sm:gap-4 min-w-0">
              <div className="w-full sm:w-1/2 h-44 sm:h-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => {
                        const color =
                          CATEGORY_COLORS[entry.name] ||
                          FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                        return <Cell key={`cell-${index}`} fill={color} stroke={cellStroke} strokeWidth={2} />;
                      })}
                    </Pie>
                    <Tooltip content={<CustomDonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend List */}
              <div className="w-full sm:w-1/2 max-h-24 sm:max-h-52 overflow-y-auto space-y-1 sm:space-y-1.5 pr-1 min-w-0">
                {donutData.slice(0, 5).map((entry, index) => {
                  const color =
                    CATEGORY_COLORS[entry.name] ||
                    FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                  const pct = totalExpenseVal > 0 ? Math.round((entry.value / totalExpenseVal) * 100) : 0;
                  return (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-slate-200/60 dark:border-transparent transition-colors min-w-0"
                    >
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-slate-800 dark:text-slate-300 truncate">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pl-1">
                        <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200 font-semibold">{formatINR(entry.value)}</span>
                        <span className="text-[10px] tabular-nums text-slate-500 w-6 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="dayLabel" stroke={axisColor} fontSize={10} tickLine={false} />
              <YAxis stroke={axisColor} fontSize={10} tickLine={false} tickFormatter={(val) => `₹${val}`} />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
                formatter={(val) => (
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{val}</span>
                )}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
