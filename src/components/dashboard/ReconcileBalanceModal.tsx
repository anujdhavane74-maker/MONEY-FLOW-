'use client';

import React, { useState } from 'react';
import {
  X,
  Scale,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  HelpCircle,
} from 'lucide-react';
import { db } from '@/lib/db';
import { pushToCloud } from '@/lib/sync';
import { formatINR, getActiveCurrency } from '@/lib/formatters';
import { Transaction, Category } from '@/lib/types';

interface ReconcileBalanceModalProps {
  calculatedBalance: number;
  categories: Category[];
  onClose: () => void;
  onReconciled: () => void;
}

export function ReconcileBalanceModal({
  calculatedBalance,
  categories,
  onClose,
  onReconciled,
}: ReconcileBalanceModalProps) {
  const [actualBalanceInput, setActualBalanceInput] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Food & Dining');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const curProfile = getActiveCurrency();
  const actualBalanceNum = parseFloat(actualBalanceInput);
  const hasValidInput = !isNaN(actualBalanceNum) && actualBalanceInput.trim() !== '';

  // Difference: actual - calculated
  // Negative means real bank has less (unaccounted expenses)
  // Positive means real bank has more (unaccounted income)
  const difference = hasValidInput ? actualBalanceNum - calculatedBalance : 0;
  const absDiff = Math.abs(difference);

  const handleApplyReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValidInput || Math.abs(difference) < 0.01) return;

    setIsSubmitting(true);
    try {
      const now = Date.now();
      const isExpense = difference < 0;

      const newTxn: Transaction = {
        id: `txn-reconcile-${now}-${Math.random().toString(36).slice(2, 6)}`,
        amount: Math.round(absDiff * 100) / 100,
        type: isExpense ? 'expense' : 'income',
        category: selectedCategory,
        merchant: isExpense ? 'Unaccounted Micro-Spends' : 'Unaccounted Income / Cashback',
        timestamp: now,
        source: 'manual',
        bankOrApp: 'Balance Reconciliation',
        notes: `Balance adjustment: actual bank was ${formatINR(actualBalanceNum)} vs app ${formatINR(calculatedBalance)}`,
        isCategorized: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.transactions.add(newTxn);
      pushToCloud().catch(() => {});

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }

      setIsSuccess(true);
      onReconciled();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to reconcile balance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle on Mobile */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Reconcile Bank / UPI Lite Balance
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Catches untracked chai, auto & cash micro-spends
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {isSuccess ? (
            <div className="p-6 text-center space-y-3 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Balance Reconciled!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged an adjustment of <strong>{formatINR(absDiff)}</strong>. Your Money Flow balance now perfectly matches your bank.
              </p>
            </div>
          ) : (
            <form onSubmit={handleApplyReconciliation} className="space-y-4">
              {/* Calculated App Balance Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Calculated App Balance:
                  </span>
                  <span className="text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatINR(calculatedBalance)}
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <span>Based on recorded income & expenses</span>
                </div>
              </div>

              {/* Input for Actual Bank Balance */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  What is your actual Bank or UPI Lite balance right now?
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400">
                    {curProfile.symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    placeholder="e.g. 12450"
                    value={actualBalanceInput}
                    onChange={(e) => setActualBalanceInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 tabular-nums"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Difference Banner */}
              {hasValidInput && (
                <div className="space-y-3 animate-fade-in">
                  {Math.abs(difference) < 0.01 ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>✨ 100% in sync! Your Money Flow records match your real bank balance.</span>
                    </div>
                  ) : difference < 0 ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2">
                      <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <TrendingDown className="w-4 h-4" />
                          <span>Unaccounted Micro-Spends:</span>
                        </div>
                        <span className="font-mono font-black text-sm">
                          -{formatINR(absDiff)}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-600/90 dark:text-rose-300 leading-snug">
                        Your real bank account has <strong>{formatINR(absDiff)}</strong> less than Money Flow. These are typically untracked small chai, auto, snacks, or cash payments without SMS.
                      </p>

                      {/* Category selector */}
                      <div className="pt-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Attribute adjustment to category:
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="Food & Dining">Food & Dining (Chai / Snacks)</option>
                          <option value="Travel & Transit">Travel & Transit (Auto / Metro)</option>
                          <option value="Shopping">Shopping (Kirana / Groceries)</option>
                          <option value="Transfers">Miscellaneous / Cash</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          <TrendingUp className="w-4 h-4" />
                          <span>Unaccounted Surplus / Refund:</span>
                        </div>
                        <span className="font-mono font-black text-sm">
                          +{formatINR(absDiff)}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300 leading-snug">
                        Your bank account has <strong>{formatINR(absDiff)}</strong> more than Money Flow. This could be an untracked cashback, friend reimbursement, or interest credit.
                      </p>

                      <div className="pt-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Attribute adjustment to category:
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="Cashback & Refunds">Cashback & Refunds</option>
                          <option value="Salary / Stipend">Salary / Stipend</option>
                          <option value="Pocket Money / Allowance">Pocket Money / Allowance</option>
                          <option value="Freelance & Side Gigs">Freelance & Side Gigs</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  {Math.abs(difference) >= 0.01 && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all"
                    >
                      <Scale className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Reconciling...'
                          : difference < 0
                          ? `1-Tap Log -${formatINR(absDiff)} Micro-Spends Expense`
                          : `1-Tap Log +${formatINR(absDiff)} Income Adjustment`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
