'use client';

import React, { useState } from 'react';
import {
  X,
  Zap,
  Coffee,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Sparkles,
  Delete,
  Check,
} from 'lucide-react';
import { db } from '@/lib/db';
import { pushToCloud } from '@/lib/sync';
import { getActiveCurrency, formatINR } from '@/lib/formatters';
import { Category, Transaction } from '@/lib/types';

interface QuickLogSheetProps {
  categories: Category[];
  onClose: () => void;
  onLogged: () => void;
}

interface QuickPreset {
  id: string;
  name: string;
  defaultAmount: number;
  category: string;
  icon: React.ElementType;
  emoji: string;
}

const MICRO_PRESETS: QuickPreset[] = [
  { id: 'chai', name: 'Cutting Chai', defaultAmount: 15, category: 'Food & Dining', icon: Coffee, emoji: '☕' },
  { id: 'vadapav', name: 'Vadapav / Snacks', defaultAmount: 20, category: 'Food & Dining', icon: UtensilsCrossed, emoji: '🥪' },
  { id: 'auto', name: 'Shared Auto / Bus', defaultAmount: 30, category: 'Travel & Transit', icon: Car, emoji: '🛺' },
  { id: 'coffee', name: 'Cold Coffee', defaultAmount: 50, category: 'Food & Dining', icon: Coffee, emoji: '🥤' },
  { id: 'groceries', name: 'Milk / Groceries', defaultAmount: 65, category: 'Shopping', icon: ShoppingBag, emoji: '🥛' },
  { id: 'misc', name: 'Quick Micro-Spend', defaultAmount: 20, category: 'Food & Dining', icon: Sparkles, emoji: '⚡' },
];

export function QuickLogSheet({ categories, onClose, onLogged }: QuickLogSheetProps) {
  const [selectedPreset, setSelectedPreset] = useState<QuickPreset>(MICRO_PRESETS[0]);
  const [amountStr, setAmountStr] = useState<string>(MICRO_PRESETS[0].defaultAmount.toString());
  const [isSaving, setIsSaving] = useState(false);

  const curProfile = getActiveCurrency();
  const quickAmountPills = [10, 15, 20, 30, 50, 100, 200];

  // Numpad key press handler
  const handleNumpadPress = (val: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }

    if (val === 'backspace') {
      setAmountStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
      return;
    }

    if (val === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr((prev) => (prev === '' ? '0.' : prev + '.'));
      return;
    }

    // Digit pressed
    setAmountStr((prev) => {
      if (prev === '0') return val;
      // Limit to 7 digits
      if (prev.length >= 7) return prev;
      return prev + val;
    });
  };

  const handleSelectPreset = (preset: QuickPreset) => {
    setSelectedPreset(preset);
    setAmountStr(preset.defaultAmount.toString());
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const handleQuickAmountChip = (amt: number) => {
    setAmountStr(amt.toString());
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  // Instant 1-second log
  const handleSaveExpense = async () => {
    const parsedAmt = parseFloat(amountStr);
    if (isNaN(parsedAmt) || parsedAmt <= 0) return;

    setIsSaving(true);
    try {
      const now = Date.now();
      const newTxnId = `txn-quick-${now}-${Math.random().toString(36).slice(2, 6)}`;

      const newTxn: Transaction = {
        id: newTxnId,
        amount: parsedAmt,
        type: 'expense',
        category: selectedPreset.category,
        merchant: selectedPreset.name,
        timestamp: now,
        source: 'manual',
        bankOrApp: '1-Sec Quick Numpad',
        notes: `Quick Log: ${selectedPreset.name}`,
        isCategorized: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.transactions.add(newTxn);
      pushToCloud().catch(() => {});

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 20, 40]);
      }

      onLogged();
      onClose();
    } catch (err) {
      console.error('Failed to quick log expense:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const numAmount = parseFloat(amountStr) || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Top Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                1-Second Quick Numpad
              </h3>
              <p className="text-[10px] text-slate-400 truncate">
                Log chai, auto & snacks before you put your phone away
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preset Micro-Spend Carousel */}
        <div className="p-3 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {MICRO_PRESETS.map((p) => {
              const isSelected = selectedPreset.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2">
            {quickAmountPills.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleQuickAmountChip(amt)}
                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                  amountStr === amt.toString()
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Big Display */}
        <div className="p-4 text-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            {selectedPreset.name} • {selectedPreset.category}
          </span>
          <div className="text-4xl font-black font-mono text-slate-900 dark:text-white tabular-nums mt-1">
            <span className="text-emerald-600 dark:text-emerald-400 mr-1">{curProfile.symbol}</span>
            {amountStr || '0'}
          </div>
        </div>

        {/* 3x4 Touch Calculator Numpad */}
        <div className="p-3 grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/90">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleNumpadPress(digit)}
              className="h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-lg font-bold font-mono text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 active:scale-95 transition-all shadow-xs"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNumpadPress('backspace')}
            className="h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95 transition-all"
            aria-label="Backspace"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Big 1-Tap Save Action */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleSaveExpense}
            disabled={numAmount <= 0 || isSaving}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all disabled:opacity-40"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSaving ? 'Logging...' : `Log ${formatINR(numAmount)} in 1 Tap`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
