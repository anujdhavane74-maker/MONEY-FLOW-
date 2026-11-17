'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Zap,
  Calendar,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  PieChart as PieIcon,
  Flame,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Transaction, Category, RecurringBill, IOU } from '@/lib/types';
import { formatINR, formatISTDate, getActiveCurrency } from '@/lib/formatters';

interface AnalyticsViewProps {
  transactions: Transaction[];
  categories: Category[];
  bills: RecurringBill[];
  ious: IOU[];
  monthlyBudget?: number;
}

type Timeframe = '7D' | '30D' | '90D' | '1Y' | 'ALL';

const PALETTE = [
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#E11D48', // Rose
  '#64748B', // Slate
];

export function AnalyticsView({
  transactions,
  categories,
  bills,
  ious,
  monthlyBudget = 25000,
}: AnalyticsViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('30D');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const activeCur = getActiveCurrency();

  const now = Date.now();
  const dayMs = 86400000;

  // 1. Filter transactions by timeframe
  const filteredTxns = useMemo(() => {
    let cutoff = 0;
    if (timeframe === '7D') cutoff = now - dayMs * 7;
    else if (timeframe === '30D') cutoff = now - dayMs * 30;
    else if (timeframe === '90D') cutoff = now - dayMs * 90;
    else if (timeframe === '1Y') cutoff = now - dayMs * 365;

    return transactions.filter((t) => t.timestamp >= cutoff);
  }, [transactions, timeframe, now, dayMs]);

  // 2. High-level financial totals
  const totalIncome = useMemo(
    () => filteredTxns.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [filteredTxns]
  );

  const totalExpense = useMemo(
    () => filteredTxns.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [filteredTxns]
  );

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // 3. Days in timeframe & daily burn rate
  const daysInPeriod = useMemo(() => {
    if (timeframe === '7D') return 7;
    if (timeframe === '30D') return 30;
    if (timeframe === '90D') return 90;
    if (timeframe === '1Y') return 365;
    return 30;
  }, [timeframe]);

  const dailyBurnVelocity = Math.round(totalExpense / Math.max(1, daysInPeriod));

  // Current calendar month projection
  const daysInCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentDay = new Date().getDate();
  const remainingDaysInMonth = Math.max(1, daysInCurrentMonth - currentDay);
  const projectedMonthEndSpend = Math.round(totalExpense + dailyBurnVelocity * remainingDaysInMonth);

  // 4. Time series grouping for Cash Flow chart
  const cashFlowData = useMemo(() => {
    const buckets: Record<string, { date: string; income: number; expense: number; savings: number }> = {};
    const stepDays = timeframe === '7D' ? 1 : timeframe === '30D' ? 2 : timeframe === '90D' ? 7 : 30;

    filteredTxns.forEach((t) => {
      const d = new Date(t.timestamp);
      const key = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      if (!buckets[key]) {
        buckets[key] = { date: key, income: 0, expense: 0, savings: 0 };
      }
      if (t.type === 'income') buckets[key].income += t.amount;
      if (t.type === 'expense') buckets[key].expense += t.amount;
      buckets[key].savings = Math.max(0, buckets[key].income - buckets[key].expense);
    });

    return Object.values(buckets).slice(-15);
  }, [filteredTxns, timeframe]);

  // 5. Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredTxns
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + t.amount;
      });

    return Object.entries(catMap)
      .map(([name, amount], idx) => ({
        name,
        amount,
        percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color: PALETTE[idx % PALETTE.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTxns, totalExpense]);

  // 6. Interactive Drill-Down for selected category
  const drillDownData = useMemo(() => {
    if (!selectedCategory) return null;
    const catTxns = filteredTxns.filter(
      (t) => t.type === 'expense' && t.category.toLowerCase() === selectedCategory.toLowerCase()
    );

    const totalCatSpend = catTxns.reduce((sum, t) => sum + t.amount, 0);

    // Rank top merchants in this category
    const merchantMap: Record<string, { count: number; spend: number }> = {};
    catTxns.forEach((t) => {
      const m = t.merchant || 'Unknown';
      if (!merchantMap[m]) merchantMap[m] = { count: 0, spend: 0 };
      merchantMap[m].count += 1;
      merchantMap[m].spend += t.amount;
    });

    const topMerchants = Object.entries(merchantMap)
      .map(([merchant, data]) => ({
        merchant,
        spend: data.spend,
        count: data.count,
        percent: totalCatSpend > 0 ? Math.round((data.spend / totalCatSpend) * 100) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      category: selectedCategory,
      totalSpend: totalCatSpend,
      topMerchants,
      transactions: catTxns.slice(0, 8),
    };
  }, [selectedCategory, filteredTxns]);

  // 7. Plain-English Smart Financial Alerts
  const smartInsights = useMemo(() => {
    const insights: { icon: any; title: string; desc: string; type: 'success' | 'warning' | 'info' }[] = [];

    // Savings rate insight
    if (savingsRate >= 30) {
      insights.push({
        icon: Sparkles,
        title: `Outstanding ${savingsRate}% Savings Rate`,
        desc: `You are saving well above the recommended 20% benchmark for this timeframe.`,
        type: 'success',
      });
    } else if (savingsRate < 10 && totalIncome > 0) {
      insights.push({
        icon: AlertTriangle,
        title: `Low Savings Margin (${savingsRate}%)`,
        desc: `Expenses consumed ${(100 - savingsRate)}% of total income. Consider trimming top merchant spending.`,
        type: 'warning',
      });
    }

    // Top category insight
    if (categoryBreakdown.length > 0) {
      const topCat = categoryBreakdown[0];
      insights.push({
        icon: ShoppingBag,
        title: `${topCat.name} is your largest expense (${topCat.percent}%)`,
        desc: `Totaling ${formatINR(topCat.amount)} over the selected ${timeframe} period. Tap the category to inspect top merchants.`,
        type: 'info',
      });
    }

    // Recurring subscriptions insight
    const activeBills = bills.filter((b) => b.isActive);
    if (activeBills.length > 0) {
      const totalBillsMonthly = activeBills.reduce(
        (sum, b) => sum + (b.billingCycle === 'monthly' ? b.amount : Math.round(b.amount / 12)),
        0
      );
      insights.push({
        icon: Clock,
        title: `${activeBills.length} Active Recurring Commitments`,
        desc: `Fixed subscriptions and bills account for ${formatINR(totalBillsMonthly)}/month (${Math.round((totalBillsMonthly / monthlyBudget) * 100)}% of your target budget).`,
        type: 'info',
      });
    }

    // Pending IOU insight
    const pendingIOUs = ious.filter((i) => i.status === 'pending');
    if (pendingIOUs.length > 0) {
      const pendingSum = pendingIOUs.reduce((sum, i) => sum + i.amount, 0);
      insights.push({
        icon: TrendingUp,
        title: `${formatINR(pendingSum)} Pending in Splitwise IOUs`,
        desc: `You have ${pendingIOUs.length} unsettled friend balances that will recover into your cash flow upon settlement.`,
        type: 'success',
      });
    }

    return insights;
  }, [savingsRate, totalIncome, categoryBreakdown, timeframe, bills, monthlyBudget, ious]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-7xl mx-auto min-w-0 w-full overflow-hidden">
      {/* Top Bar: Heading & Timeframe Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Cash Flow & Spending Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-timeframe velocity, burn rates, category rankings & predictive forecast
          </p>
        </div>

        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start sm:self-auto shadow-xs">
          {(['7D', '30D', '90D', '1Y', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => {
                setTimeframe(tf);
                setSelectedCategory(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeframe === tf
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPI Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 min-w-0">
        {/* Card 1: Net Savings & Rate */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] min-w-0 overflow-hidden space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Savings</span>
            <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
            {formatINR(netSavings)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{savingsRate}% Savings Rate</span>
          </div>
        </div>

        {/* Card 2: Daily Burn Velocity */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] min-w-0 overflow-hidden space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Burn Velocity</span>
            <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
            {formatINR(dailyBurnVelocity)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Average spend / day</span>
        </div>

        {/* Card 3: Projected Spend */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] min-w-0 overflow-hidden space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Est. Month-End</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
            {formatINR(projectedMonthEndSpend)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Based on current trajectory</span>
        </div>

        {/* Card 4: Total Inflow */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] min-w-0 overflow-hidden space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Inflow</span>
            <ArrowUpRight className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
            {formatINR(totalIncome)}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{filteredTxns.length} total txns</span>
        </div>
      </div>

      {/* Main Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-w-0 items-start">
        {/* Left Column (7 cols): Cash Flow Trend Chart */}
        <div className="lg:col-span-7 p-4 sm:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Inflow vs. Outflow Cash Flow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Income compared directly with outgoing expenditures
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Inflow
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Outflow
              </span>
            </div>
          </div>

          <div className="h-64 w-full min-w-0 overflow-hidden">
            {cashFlowData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                No transaction data in selected timeframe.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} stroke="#334155" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} stroke="#334155" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '1rem',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="#F43F5E"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Category Distribution Donut */}
        <div className="lg:col-span-5 p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Category Spending
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tap any category to inspect top merchants
              </p>
            </div>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="h-52 w-full min-w-0 flex items-center justify-center">
            {categoryBreakdown.length === 0 ? (
              <span className="text-xs text-slate-400">No expense records found.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="amount"
                    onClick={(entry: any) => setSelectedCategory(entry?.name ?? null)}
                    cursor="pointer"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={selectedCategory === entry.name ? '#FFFFFF' : 'transparent'}
                        strokeWidth={selectedCategory === entry.name ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '0.75rem',
                      color: '#F8FAFC',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), 'Spend']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Interactive Category List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {categoryBreakdown.map((cat) => {
              const isSelected = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat.name)}
                  className={`w-full p-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-slate-800 dark:text-slate-200 truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-slate-900 dark:text-white font-semibold">
                      {formatINR(cat.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">({cat.percent}%)</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Category Drill-Down Drawer (Shows when slice is clicked) */}
      {drillDownData && (
        <div className="p-4 sm:p-6 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {drillDownData.category} Breakdown
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Total spent: <strong className="font-mono text-emerald-700 dark:text-emerald-300">{formatINR(drillDownData.totalSpend)}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Close Filter
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Merchants in this category */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top Counterparties ({drillDownData.topMerchants.length})
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {drillDownData.topMerchants.map((m, idx) => (
                  <div key={m.merchant} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-[10px] flex items-center justify-center font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {m.merchant}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatINR(m.spend)}
                      </span>
                      <span className="block text-[10px] text-slate-400">{m.count} visit{m.count > 1 ? 's' : ''} ({m.percent}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent transactions in this category */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recent Transactions in {drillDownData.category}
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {drillDownData.transactions.map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {t.merchant}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatISTDate(t.timestamp)}</span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      -{formatINR(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart AI Financial Insights Engine */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 animate-spin-slow" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Smart Plain-English Insights
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {smartInsights.map((insight, idx) => {
            const Icon = insight.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3 shadow-2xs"
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    insight.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : insight.type === 'warning'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{insight.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {insight.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
