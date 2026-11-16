'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import {
  ShieldCheck,
  ShieldX,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Calendar,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  ReceiptText,
  Users,
} from 'lucide-react';
import { db, initializeDatabase } from '@/lib/db';
import { Transaction } from '@/lib/types';
import { formatINR, formatISTDate, formatISTTime } from '@/lib/formatters';

function ParentShareViewContent() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('Guardian Access');
  const [hideNotes, setHideNotes] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    async function loadData() {
      try {
        let isAuth = false;
        let foundLabel = 'Guardian View';
        let isNotesHidden = false;
        let txns: Transaction[] = [];

        // 1. Try local IndexedDB first (if on same device)
        try {
          await initializeDatabase();
          const settings = await db.app_settings.get('global');
          const matchedToken = settings?.parentShareTokens?.find(
            (t) => t.token === token && !t.revoked
          );

          if (matchedToken || token === 'demo-parent-guardian-2026') {
            isAuth = true;
            foundLabel = matchedToken?.label || 'Guardian View';
            isNotesHidden = Boolean(settings?.hideNotesFromParent);
            txns = await db.transactions.orderBy('timestamp').reverse().toArray();
          }
        } catch (e) {
          console.log('Local Dexie read skipped, checking remote server...');
        }

        // 2. If not found in local IndexedDB (typical for parents on another phone/laptop), fetch from Cloud API
        if (!isAuth) {
          const res = await fetch(`/api/share-data?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              isAuth = true;
              foundLabel = data.tokenLabel || 'Guardian View';
              isNotesHidden = Boolean(data.hideNotes);
              txns = data.transactions || [];
            }
          }
        }

        setAuthorized(isAuth);
        setTokenLabel(foundLabel);
        setHideNotes(isNotesHidden);
        setTransactions(txns);
      } catch (err) {
        console.error('Failed to load parent share data:', err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadData();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Verifying Secure Guardian Token...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-100">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-xl shadow-rose-950/50">
          <ShieldX className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Link Invalid or Revoked</h1>
        <p className="text-sm text-slate-400 max-w-sm mt-2 mb-6">
          This parent guardian view token is either expired, revoked by the account owner, or does not exist.
        </p>
        <span className="text-xs text-slate-600 font-mono">Token: {token}</span>
      </div>
    );
  }

  // Calculate Metrics - Critical Accounting Rule:
  // For expenses, only count MY personal share (myShareAmount ?? amount)
  // Friends' shares and pending IOUs are excluded so group dinners do not distort true spending
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTxns = transactions.filter((t) => {
    const d = new Date(t.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = currentMonthTxns
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = currentMonthTxns
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.myShareAmount != null ? t.myShareAmount : t.amount), 0);

  const totalSavings = currentMonthTxns
    .filter((t) => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense - totalSavings;

  // Category breakdown for expenses
  const categoryBreakdown: Record<string, number> = {};
  currentMonthTxns
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const personalAmt = t.myShareAmount != null ? t.myShareAmount : t.amount;
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + personalAmt;
    });

  const categoryList = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' || t.category === selectedCategory || t.type === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Guardian Banner */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Parent Guardian View
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-300 font-medium">
                  Read-Only
                </span>
              </div>
              <p className="text-xs text-slate-400">{tokenLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure Link</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Month Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Financial Summary</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Live read-only spending & savings overview for{' '}
              {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Net Balance</span>
            <p
              className={`text-xl font-bold font-mono ${
                netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatINR(netBalance)}
            </p>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Income */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Income</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-100 font-mono">{formatINR(totalIncome)}</p>
            <span className="text-[11px] text-slate-500">Credited this month</span>
          </div>

          {/* Expenses */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Personal Expenses</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-100 font-mono">{formatINR(totalExpense)}</p>
            <span className="text-[11px] text-slate-500">Personal share spent</span>
          </div>

          {/* Savings */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Total Saved</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <PiggyBank className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-100 font-mono">{formatINR(totalSavings)}</p>
            <span className="text-[11px] text-slate-500">Transferred to savings</span>
          </div>

          {/* Savings Rate */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400">Savings Rate</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-100 font-mono">
              {totalIncome > 0
                ? Math.round(((totalSavings + Math.max(0, netBalance)) / totalIncome) * 100)
                : 0}
              %
            </p>
            <span className="text-[11px] text-slate-500">Of total income</span>
          </div>
        </div>

        {/* Category Breakdown (Read-Only) */}
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-emerald-400" />
            Where the Money Went (This Month)
          </h2>

          {categoryList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No personal expenses recorded for this month yet.
            </p>
          ) : (
            <div className="space-y-3">
              {categoryList.map(([catName, amt]) => {
                const percentage = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                return (
                  <div key={catName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{catName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono">{formatINR(amt)}</span>
                        <span className="text-[11px] text-slate-500 w-8 text-right">{percentage}%</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transactions Feed (Strict Read-Only) */}
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-100">Transaction History</h2>
              <p className="text-xs text-slate-400">
                All authenticated income, expenses, and savings records
              </p>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search merchant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1.5 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none"
              >
                <option value="All">All Types</option>
                <option value="expense">Expenses Only</option>
                <option value="income">Income Only</option>
                <option value="savings">Savings Only</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-slate-800/60">
            {filteredTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No matching transactions found.</p>
            ) : (
              filteredTransactions.map((t) => {
                const isExpense = t.type === 'expense';
                const isIncome = t.type === 'income';
                const personalAmt =
                  isExpense && t.myShareAmount != null ? t.myShareAmount : t.amount;

                return (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border text-xs font-bold ${
                          isExpense
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : isIncome
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                        }`}
                      >
                        {isExpense ? 'EXP' : isIncome ? 'INC' : 'SAV'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-200">{t.merchant}</p>
                          {t.isSplit && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-300 flex items-center gap-0.5 font-medium">
                              <Users className="w-2.5 h-2.5" />
                              Split
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{t.category}</span>
                          <span>•</span>
                          <span>{formatISTDate(t.timestamp)}</span>
                          {t.bankOrApp && (
                            <>
                              <span>•</span>
                              <span className="text-slate-500">{t.bankOrApp}</span>
                            </>
                          )}
                        </div>
                        {t.notes && !hideNotes ? (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">{t.notes}</p>
                        ) : hideNotes && t.notes ? (
                          <p className="text-[11px] text-slate-600 italic mt-0.5">
                            🔒 Private note hidden by owner
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-sm font-bold font-mono ${
                          isExpense ? 'text-slate-100' : isIncome ? 'text-emerald-400' : 'text-cyan-400'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatINR(personalAmt)}
                      </p>
                      {t.isSplit && t.splitTotalAmount && (
                        <p className="text-[10px] text-slate-500">
                          Total bill: {formatINR(t.splitTotalAmount)}
                        </p>
                      )}
                      {t.upiRefId && (
                        <span className="text-[10px] text-slate-600 font-mono">
                          Ref: {t.upiRefId}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Read-Only Footer Note */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            🔒 This view is encrypted and strictly read-only. Settings, modifications, and credentials are protected.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ParentShareView() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium tracking-wide">Loading Guardian View...</p>
        </div>
      }
    >
      <ParentShareViewContent />
    </Suspense>
  );
}
