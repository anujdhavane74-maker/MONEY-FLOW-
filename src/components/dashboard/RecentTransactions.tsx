'use client';

import React, { useState, memo } from 'react';
import {
  Search,
  Trash2,
  Tag,
  Sparkles,
  CheckCircle2,
  Edit2,
  FileSpreadsheet,
  Smartphone,
} from 'lucide-react';
import { Transaction, Category } from '@/lib/types';
import { formatINR, formatRelativeIST } from '@/lib/formatters';
import { db, learnMerchantRule } from '@/lib/db';

interface RecentTransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  onOpenCategorizeModal: (txn: Transaction) => void;
  onRefresh: () => void;
}

export const RecentTransactions = memo(function RecentTransactions({
  transactions,
  categories,
  onOpenCategorizeModal,
  onRefresh,
}: RecentTransactionsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income' | 'savings'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  // Quick 1-tap category changer popup state
  const [activeCategoryPickerId, setActiveCategoryPickerId] = useState<string | null>(null);

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.notes && t.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.upiRefId && t.upiRefId.includes(searchQuery));

    const matchesType = selectedType === 'all' || t.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

    return matchesSearch && matchesType && matchesCategory;
  });

  const handleDelete = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      await db.transactions.delete(id);
      onRefresh();
    }
  };

  const handleSaveNotes = async (id: string) => {
    await db.transactions.update(id, { notes: tempNotes.trim(), updatedAt: Date.now() });
    setEditingNotesId(null);
    onRefresh();
  };

  const handleQuickChangeCategory = async (txn: Transaction, newCategoryName: string) => {
    await db.transactions.update(txn.id, {
      category: newCategoryName,
      isCategorized: true,
      updatedAt: Date.now(),
    });
    // Auto-learn rule for this merchant
    await learnMerchantRule(txn.merchant, newCategoryName);
    setActiveCategoryPickerId(null);
    onRefresh();
  };

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 text-[10px] text-cyan-700 dark:text-cyan-300 font-medium">
            <Smartphone className="w-2.5 h-2.5" /> SMS Auto
          </span>
        );
      case 'gpay_csv':
      case 'gpay_pdf':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[10px] text-blue-700 dark:text-blue-300 font-medium">
            <FileSpreadsheet className="w-2.5 h-2.5" /> GPay Reconciled
          </span>
        );
      case 'webhook':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-[10px] text-purple-700 dark:text-purple-300 font-medium">
            <Sparkles className="w-2.5 h-2.5" /> Webhook
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-3.5 sm:space-y-4 transition-colors min-w-0 w-full overflow-hidden">
      {/* Feed Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
            <span>Recent Activity</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
              {filtered.length}
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Real-time transactions with 1-tap categorization</p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-56 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search merchant, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-w-0"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none w-full max-w-full min-w-0">
        {(['all', 'expense', 'income', 'savings'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1 min-h-[32px] rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all shrink-0 ${
              selectedType === type
                ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {type === 'all' ? 'All Types' : type}
          </button>
        ))}

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-2.5 py-1 min-h-[32px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 min-w-0">
        {filtered.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No transactions match your criteria</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Log a transaction or paste a bank SMS to begin.</p>
          </div>
        ) : (
          filtered.map((txn) => {
            const isExpense = txn.type === 'expense';
            const isIncome = txn.type === 'income';
            const isPendingCategorization = !txn.isCategorized;

            return (
              <div
                key={txn.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/20 px-1 sm:px-2 rounded-2xl transition-colors min-w-0"
              >
                {/* Left side: Icon & Merchant details */}
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center border font-bold text-xs shrink-0 mt-0.5 ${
                      isExpense
                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'
                        : isIncome
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'
                        : 'bg-cyan-50 border-cyan-200 text-cyan-600 dark:bg-cyan-500/10 dark:border-cyan-500/20 dark:text-cyan-400'
                    }`}
                  >
                    {isExpense ? 'EXP' : isIncome ? 'INC' : 'SAV'}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs">{txn.merchant}</span>
                      {renderSourceBadge(txn.source)}
                      {isPendingCategorization && (
                        <button
                          onClick={() => onOpenCategorizeModal(txn)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/40 dark:text-amber-300 font-bold hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors animate-pulse shrink-0"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                          Categorize
                        </button>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap min-w-0">
                      {/* 1-tap Category pill */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveCategoryPickerId(
                              activeCategoryPickerId === txn.id ? null : txn.id
                            )
                          }
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                          title="Change Category"
                        >
                          <Tag className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[100px]">{txn.category}</span>
                        </button>

                        {/* Dropdown Quick Category Picker */}
                        {activeCategoryPickerId === txn.id && (
                          <div
                            className="absolute left-0 top-6 z-30 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 space-y-1 animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 block py-1">
                              Pick Category:
                            </span>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {categories
                                .filter((c) => c.type === txn.type)
                                .map((cat) => (
                                   <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleQuickChangeCategory(txn, cat.name)}
                                    className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 transition-colors flex items-center justify-between"
                                  >
                                    <span className="truncate">{cat.name}</span>
                                    {txn.category === cat.name && (
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    )}
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <span>•</span>
                      <span className="tabular-nums shrink-0">{formatRelativeIST(txn.timestamp)}</span>

                      {txn.bankOrApp && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 dark:text-slate-500 truncate max-w-[80px]">{txn.bankOrApp}</span>
                        </>
                      )}
                    </div>

                    {/* Notes editing */}
                    {editingNotesId === txn.id ? (
                      <div className="flex items-center gap-1.5 pt-1 min-w-0">
                        <input
                          type="text"
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Add custom note..."
                          className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500 min-w-0 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveNotes(txn.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs shrink-0"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      txn.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate max-w-xs">
                          &ldquo;{txn.notes}&rdquo;
                        </p>
                      )
                    )}
                  </div>
                </div>

                {/* Right side: Amount and Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-11 sm:pl-0 pt-1 sm:pt-0 shrink-0">
                  <div className="text-right shrink-0">
                    <p
                      className={`text-base font-black font-mono tracking-tight tabular-nums ${
                        isExpense
                          ? 'text-rose-600 dark:text-rose-400'
                          : isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-cyan-600 dark:text-cyan-400'
                      }`}
                    >
                      {isExpense ? '-' : '+'}{formatINR(txn.amount)}
                    </p>
                    {txn.upiRefId && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block tabular-nums truncate max-w-[120px] sm:max-w-none">
                        UTR: {txn.upiRefId}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 mt-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNotesId(txn.id);
                        setTempNotes(txn.notes || '');
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      title="Edit note"
                      aria-label="Edit note"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(txn.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
