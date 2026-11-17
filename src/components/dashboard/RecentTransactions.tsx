'use client';

import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  Search,
  Trash2,
  Tag,
  Sparkles,
  CheckCircle2,
  Edit2,
  FileSpreadsheet,
  Smartphone,
  CheckSquare,
  Square,
  Calendar,
  Layers,
  QrCode,
  Users,
  ChevronDown,
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

type FilterType = 'all' | 'income' | 'expense' | 'splits' | 'scan_pay';
type DateRange = 'all' | 'today' | 'this_month' | 'last_30d' | 'last_90d';

export const RecentTransactions = memo(function RecentTransactions({
  transactions,
  categories,
  onOpenCategorizeModal,
  onRefresh,
}: RecentTransactionsProps) {
  // Search state with 200ms debouncing
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Filters
  const [selectedType, setSelectedType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // Windowed rendering / pagination (50 items per batch)
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Bulk edit mode
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<string>>(new Set());
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>('');

  // Inline notes editing
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');

  // 1-tap quick category picker
  const [activeCategoryPickerId, setActiveCategoryPickerId] = useState<string | null>(null);

  // Debounce search query by 200ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(50);
  }, [debouncedQuery, selectedType, selectedCategory, dateRange]);

  // Date boundary calculations
  const now = Date.now();
  const dayMs = 86400000;

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Text Search
      if (debouncedQuery) {
        const matchesMerchant = t.merchant.toLowerCase().includes(debouncedQuery);
        const matchesCat = t.category.toLowerCase().includes(debouncedQuery);
        const matchesNotes = t.notes ? t.notes.toLowerCase().includes(debouncedQuery) : false;
        const matchesRef = t.upiRefId ? t.upiRefId.includes(debouncedQuery) : false;
        if (!matchesMerchant && !matchesCat && !matchesNotes && !matchesRef) return false;
      }

      // 2. Type / Source Filter
      if (selectedType === 'income' && t.type !== 'income') return false;
      if (selectedType === 'expense' && t.type !== 'expense') return false;
      if (selectedType === 'splits' && !t.isSplit) return false;
      if (selectedType === 'scan_pay' && t.source !== 'scan_pay' && t.source !== 'quick_log') return false;

      // 3. Category Filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      // 4. Date Range Filter
      if (dateRange === 'today') {
        const tDate = new Date(t.timestamp);
        const today = new Date(now);
        if (
          tDate.getDate() !== today.getDate() ||
          tDate.getMonth() !== today.getMonth() ||
          tDate.getFullYear() !== today.getFullYear()
        ) {
          return false;
        }
      } else if (dateRange === 'this_month') {
        const tDate = new Date(t.timestamp);
        const today = new Date(now);
        if (tDate.getMonth() !== today.getMonth() || tDate.getFullYear() !== today.getFullYear()) {
          return false;
        }
      } else if (dateRange === 'last_30d') {
        if (t.timestamp < now - 30 * dayMs) return false;
      } else if (dateRange === 'last_90d') {
        if (t.timestamp < now - 90 * dayMs) return false;
      }

      return true;
    });
  }, [transactions, debouncedQuery, selectedType, selectedCategory, dateRange, now]);

  // Windowed slice (locks UI rendering to 60fps even with 10k items)
  const displayed = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

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
    await learnMerchantRule(txn.merchant, newCategoryName);
    setActiveCategoryPickerId(null);
    onRefresh();
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedTxnIds.size === displayed.length) {
      setSelectedTxnIds(new Set());
    } else {
      setSelectedTxnIds(new Set(displayed.map((t) => t.id)));
    }
  };

  const handleToggleTxn = (id: string) => {
    const updated = new Set(selectedTxnIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedTxnIds(updated);
  };

  const handleApplyBulkCategory = async () => {
    if (!bulkCategoryTarget || selectedTxnIds.size === 0) return;
    const ids = Array.from(selectedTxnIds);

    await db.transactions
      .where('id')
      .anyOf(ids)
      .modify({
        category: bulkCategoryTarget,
        isCategorized: true,
        updatedAt: Date.now(),
      });

    setSelectedTxnIds(new Set());
    setIsBulkMode(false);
    onRefresh();
  };

  const renderSourceBadge = (source: string, isSplit?: boolean) => {
    if (isSplit) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 text-[10px] text-cyan-700 dark:text-cyan-300 font-bold shrink-0">
          <Users className="w-2.5 h-2.5" /> Split Bill
        </span>
      );
    }
    switch (source) {
      case 'scan_pay':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
            <QrCode className="w-2.5 h-2.5" /> Scan & Pay
          </span>
        );
      case 'quick_log':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[10px] text-amber-700 dark:text-amber-300 font-medium shrink-0">
            ⚡ Quick Log
          </span>
        );
      case 'sms':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 text-[10px] text-cyan-700 dark:text-cyan-300 font-medium shrink-0">
            <Smartphone className="w-2.5 h-2.5" /> SMS Auto
          </span>
        );
      case 'gpay_csv':
      case 'gpay_pdf':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[10px] text-blue-700 dark:text-blue-300 font-medium shrink-0">
            <FileSpreadsheet className="w-2.5 h-2.5" /> GPay Statement
          </span>
        );
      case 'webhook':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-[10px] text-purple-700 dark:text-purple-300 font-medium shrink-0">
            <Sparkles className="w-2.5 h-2.5" /> Webhook
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] space-y-4 transition-all min-w-0 w-full overflow-hidden">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
            <span>Activity & Transactions</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
              {filtered.length}
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {filtered.length === transactions.length
              ? `Live audit feed (${transactions.length} total)`
              : `Showing ${filtered.length} of ${transactions.length} transactions`}
          </p>
        </div>

        {/* Controls: Search + Bulk Mode Toggle */}
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search merchant, ref, note..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-w-0 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedTxnIds(new Set());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              isBulkMode
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBulkMode ? 'Done' : 'Bulk Edit'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Filter Pills + Date Range Selector */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full min-w-0">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'income', label: 'Income' },
              { id: 'expense', label: 'Expenses' },
              { id: 'splits', label: 'Splits' },
              { id: 'scan_pay', label: 'Scan & Pay' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedType(item.id)}
              className={`px-3 py-1 min-h-[30px] rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all shrink-0 ${
                selectedType === item.id
                  ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
            <option value="last_30d">Last 30 Days</option>
            <option value="last_90d">Last 90 Days</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 focus:outline-none shrink-0"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when Bulk Mode is active) */}
      {isBulkMode && (
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-2.5 animate-slide-up">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"
            >
              {selectedTxnIds.size === displayed.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Square className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {selectedTxnIds.size === displayed.length ? 'Deselect All' : 'Select All on Screen'}
              </span>
            </button>
            <span className="text-xs text-slate-500 font-mono">
              ({selectedTxnIds.size} selected)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkCategoryTarget}
              onChange={(e) => setBulkCategoryTarget(e.target.value)}
              className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="">Choose Category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!bulkCategoryTarget || selectedTxnIds.size === 0}
              onClick={handleApplyBulkCategory}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
            >
              Apply to {selectedTxnIds.size}
            </button>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 min-w-0">
        {displayed.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              No transactions match your criteria
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Try adjusting your search terms or filter pills.
            </p>
          </div>
        ) : (
          displayed.map((txn) => {
            const isExpense = txn.type === 'expense';
            const isIncome = txn.type === 'income';
            const isPendingCategorization = !txn.isCategorized;
            const isSelected = selectedTxnIds.has(txn.id);

            return (
              <div
                key={txn.id}
                className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1.5 sm:px-2 rounded-xl transition-colors min-w-0 ${
                  isSelected
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                }`}
              >
                {/* Left side: Selection checkbox + Icon & details */}
                <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  {isBulkMode && (
                    <button
                      type="button"
                      onClick={() => handleToggleTxn(txn.id)}
                      className="mt-2 text-slate-400 hover:text-emerald-500 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border font-bold text-xs shrink-0 mt-0.5 ${
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
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs">
                        {txn.merchant}
                      </span>
                      {renderSourceBadge(txn.source, txn.isSplit)}
                      {isPendingCategorization && (
                        <button
                          type="button"
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
                            className="absolute left-0 top-6 z-30 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-2 space-y-1 animate-fade-in"
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
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-800 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-300 transition-colors flex items-center justify-between"
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
                      <span className="tabular-nums font-mono shrink-0">
                        {formatRelativeIST(txn.timestamp)}
                      </span>

                      {txn.bankOrApp && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
                            {txn.bankOrApp}
                          </span>
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
                      {isExpense ? '-' : '+'}
                      {formatINR(txn.amount)}
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

      {/* Windowed Pagination: Load More */}
      {visibleCount < filtered.length && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Showing {displayed.length} of {filtered.length} transactions
          </span>
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 50)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition-all active:scale-95 shadow-xs"
          >
            Load Older ({Math.min(50, filtered.length - visibleCount)} more) →
          </button>
        </div>
      )}
    </div>
  );
});
