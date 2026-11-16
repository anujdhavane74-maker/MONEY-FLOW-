'use client';

import React, { useState, memo } from 'react';
import {
  Plus,
  Coffee,
  UtensilsCrossed,
  Bus,
  Car,
  ShoppingBag,
  Sparkles,
  RotateCcw,
  X,
} from 'lucide-react';
import { QuickSpendPreset, Transaction } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { db } from '@/lib/db';

interface QuickSpendsBarProps {
  presets: QuickSpendPreset[];
  onLogged: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Coffee: <Coffee className="w-3.5 h-3.5" />,
  UtensilsCrossed: <UtensilsCrossed className="w-3.5 h-3.5" />,
  Bus: <Bus className="w-3.5 h-3.5" />,
  Car: <Car className="w-3.5 h-3.5" />,
  ShoppingBag: <ShoppingBag className="w-3.5 h-3.5" />,
};

export const QuickSpendsBar = memo(function QuickSpendsBar({ presets, onLogged }: QuickSpendsBarProps) {
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Food & Dining');
  const [newIcon, setNewIcon] = useState('Coffee');

  // Undo Toast state
  const [undoTxn, setUndoTxn] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [undoTimeoutId, setUndoTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleQuickSpend = async (preset: QuickSpendPreset) => {
    // Haptic feedback
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // ignore
      }
    }

    const newTxnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanMerchant = preset.name.replace(/^[^\w\s]+/, '').trim();

    const newTxn: Transaction = {
      id: newTxnId,
      amount: preset.amount,
      type: 'expense',
      category: preset.category,
      merchant: cleanMerchant || preset.name,
      timestamp: Date.now(),
      source: 'manual',
      notes: '1-Tap Quick Spend',
      isCategorized: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.transactions.add(newTxn);

    // Set 3.5-second undo toast
    if (undoTimeoutId) clearTimeout(undoTimeoutId);
    setUndoTxn({ id: newTxnId, name: preset.name, amount: preset.amount });

    const timeout = setTimeout(() => {
      setUndoTxn(null);
    }, 3500);
    setUndoTimeoutId(timeout);

    onLogged();
  };

  const handleUndo = async () => {
    if (!undoTxn) return;
    await db.transactions.delete(undoTxn.id);
    if (undoTimeoutId) clearTimeout(undoTimeoutId);
    setUndoTxn(null);
    onLogged();
  };

  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!newName.trim() || isNaN(amt) || amt <= 0) return;

    await db.quick_presets.add({
      id: `preset-${Date.now()}`,
      name: newName.trim(),
      amount: amt,
      category: newCategory,
      icon: newIcon,
    });

    setNewName('');
    setNewAmount('');
    setShowAddPreset(false);
    onLogged();
  };

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
          1-Tap Frequent Spends:
        </span>
        <button
          type="button"
          onClick={() => setShowAddPreset(!showAddPreset)}
          className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Custom Preset
        </button>
      </div>

      {/* Preset Pills Carousel with Snap Scrolling */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handleQuickSpend(preset)}
            className="snap-start px-3.5 py-2.5 min-h-[44px] rounded-2xl bg-white hover:bg-slate-50 active:bg-emerald-50 active:scale-95 border border-slate-200 hover:border-slate-300 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:active:bg-emerald-500/20 dark:border-slate-800 dark:hover:border-slate-700 flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-xs"
          >
            <span className="text-emerald-600 dark:text-emerald-400">
              {ICON_MAP[preset.icon] || <Coffee className="w-3.5 h-3.5" />}
            </span>
            <span>{preset.name}</span>
            <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-300 font-bold bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-lg text-[11px]">
              {formatINR(preset.amount)}
            </span>
          </button>
        ))}
      </div>

      {/* Add Custom Preset Modal */}
      {showAddPreset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddPreset(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 text-slate-900 dark:text-slate-100 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Add Frequent Spend Preset</span>
              <button
                onClick={() => setShowAddPreset(false)}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreatePreset} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Label (e.g. 🥪 Samosa)</label>
                <input
                  type="text"
                  placeholder="e.g. ☕ Cutting Chai"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 25"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Travel & Transit">Travel & Transit</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Stationery & Education">Stationery & Education</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Save Preset
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating 3-Second Undo Toast */}
      {undoTxn && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/50 shadow-2xl text-xs text-slate-900 dark:text-white animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            <span>
              Logged <strong className="font-mono tabular-nums">{formatINR(undoTxn.amount)}</strong> for {undoTxn.name}
            </span>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
});
