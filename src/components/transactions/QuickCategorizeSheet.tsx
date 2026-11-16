'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  UtensilsCrossed,
  ShoppingBag,
  Car,
  GraduationCap,
  Home,
  Gamepad2,
  ArrowRightLeft,
  PiggyBank,
  Briefcase,
  Coins,
  Laptop,
  Users,
} from 'lucide-react';
import { Transaction, Category } from '@/lib/types';
import { formatINR, formatISTTime } from '@/lib/formatters';
import { db, learnMerchantRule } from '@/lib/db';

interface QuickCategorizeSheetProps {
  transaction: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onCategorized: (categoryName: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  UtensilsCrossed: <UtensilsCrossed className="w-4 h-4" />,
  ShoppingBag: <ShoppingBag className="w-4 h-4" />,
  Car: <Car className="w-4 h-4" />,
  GraduationCap: <GraduationCap className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Gamepad2: <Gamepad2 className="w-4 h-4" />,
  ArrowRightLeft: <ArrowRightLeft className="w-4 h-4" />,
  PiggyBank: <PiggyBank className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
  Coins: <Coins className="w-4 h-4" />,
  Laptop: <Laptop className="w-4 h-4" />,
};

export function QuickCategorizeSheet({
  transaction,
  categories,
  onClose,
  onCategorized,
}: QuickCategorizeSheetProps) {
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [rememberRule, setRememberRule] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Split state
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [splitFriendName, setSplitFriendName] = useState<string>('');
  const [splitCount, setSplitCount] = useState<number>(2);

  if (!transaction) return null;

  const relevantCategories = categories.filter((c) => c.type === transaction.type);

  // Split calculations
  const originalAmount = transaction.splitTotalAmount || transaction.amount;
  const myPersonalShare = isSplit
    ? Math.round((originalAmount / splitCount) * 100) / 100
    : originalAmount;
  const friendOwed = originalAmount - myPersonalShare;

  const handleSelectCategory = async (categoryName: string) => {
    setSelectedCat(categoryName);
    setIsSubmitting(true);

    try {
      await db.transactions.update(transaction.id, {
        category: categoryName,
        amount: isSplit ? myPersonalShare : originalAmount,
        isSplit,
        splitTotalAmount: originalAmount,
        myShareAmount: myPersonalShare,
        isCategorized: true,
        updatedAt: Date.now(),
      });

      if (isSplit && splitFriendName.trim() && friendOwed > 0) {
        await db.ious.add({
          id: `iou-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          transactionId: transaction.id,
          personName: splitFriendName.trim(),
          amount: friendOwed,
          status: 'pending',
          description: `${transaction.merchant} (Split)`,
          createdAt: transaction.timestamp,
        });
      }

      if (rememberRule && transaction.merchant) {
        await learnMerchantRule(transaction.merchant, categoryName);
      }

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate(40);
      }

      setTimeout(() => {
        onCategorized(categoryName);
        onClose();
      }, 250);
    } catch (err) {
      console.error('Failed to categorize transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-4 animate-slide-up max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle pill for mobile */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/60 rounded-full mx-auto sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Instant Prompt
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Where did you spend this money?</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transaction Highlight Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{transaction.merchant}</span>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatINR(originalAmount)}
              </span>
              {isSplit && (
                <span className="block text-[10px] text-cyan-700 dark:text-cyan-300 font-bold tabular-nums">
                  Your share: {formatINR(myPersonalShare)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Captured at {formatISTTime(transaction.timestamp)}</span>
            {transaction.bankOrApp && (
              <>
                <span>•</span>
                <span className="text-cyan-700 dark:text-cyan-400">{transaction.bankOrApp}</span>
              </>
            )}
            {transaction.upiRefId && (
              <>
                <span>•</span>
                <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">Ref {transaction.upiRefId}</span>
              </>
            )}
          </div>
        </div>

        {/* Split Bill Option */}
        {transaction.type === 'expense' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Split this with friends?
                </span>
              </div>
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => setIsSplit(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
              />
            </div>

            {isSplit && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700/40 text-xs animate-fade-in">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Friend's name (e.g. Rahul)"
                    value={splitFriendName}
                    onChange={(e) => setSplitFriendName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                  <select
                    value={splitCount}
                    onChange={(e) => setSplitCount(parseInt(e.target.value, 10))}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  >
                    <option value={2}>Split 2 Ways (50%)</option>
                    <option value={3}>Split 3 Ways (33%)</option>
                    <option value={4}>Split 4 Ways (25%)</option>
                  </select>
                </div>

                <div className="flex justify-between items-center text-[11px] text-cyan-700 dark:text-cyan-300 font-mono tabular-nums pt-1">
                  <span>Your Share: {formatINR(myPersonalShare)}</span>
                  <span>Owed by {splitFriendName || 'Friend'}: {formatINR(friendOwed)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1-Tap Category Pills */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
            Choose Category (1-Tap):
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {relevantCategories.map((cat) => {
              const isSelected = selectedCat === cat.name;
              return (
                <button
                  key={cat.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSelectCategory(cat.name)}
                  className={`p-3 min-h-[48px] rounded-2xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-300 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700/60 dark:text-slate-200'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                  >
                    {ICON_MAP[cat.icon] || <UtensilsCrossed className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-medium truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Smart Rule Automation Checkbox */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberRule"
              checked={rememberRule}
              onChange={(e) => setRememberRule(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600"
            />
            <label htmlFor="rememberRule" className="text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              Remember for future transactions from &ldquo;{transaction.merchant}&rdquo;
            </label>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        </div>

        {/* Footer Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          I&apos;ll categorize later
        </button>
      </div>
    </div>
  );
}
