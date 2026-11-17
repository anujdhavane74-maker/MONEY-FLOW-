'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Mic,
  FileSpreadsheet,
  MessageSquareText,
  LayoutDashboard,
  Receipt,
  TrendingUp,
  PiggyBank,
  Settings,
  Lock,
  ArrowRight,
  Clock,
  X,
  CreditCard,
  Users,
  QrCode,
  Zap,
  Scale,
} from 'lucide-react';
import { TabType } from './BottomNav';
import { Transaction } from '@/lib/types';
import { formatCurrency, formatISTDate } from '@/lib/formatters';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: TabType) => void;
  onOpenAdd: () => void;
  onOpenScanAndPay?: () => void;
  onOpenQuickLog?: () => void;
  onOpenReconcile?: () => void;
  onOpenVoice: () => void;
  onOpenImport: () => void;
  onOpenQuickPaste: () => void;
  onLockApp: () => void;
  transactions?: Transaction[];
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'Actions' | 'Navigation' | 'Security';
  action: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onNavigate,
  onOpenAdd,
  onOpenScanAndPay,
  onOpenQuickLog,
  onOpenReconcile,
  onOpenVoice,
  onOpenImport,
  onOpenQuickPaste,
  onLockApp,
  transactions = [],
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commandItems: CommandItem[] = useMemo(() => [
    {
      id: 'cmd-scan-pay',
      title: 'Scan & Pay UPI QR',
      subtitle: 'Scan merchant QR, auto-log expense & launch Google Pay / PhonePe',
      icon: <QrCode className="w-4 h-4 text-emerald-500" />,
      shortcut: 'Q',
      category: 'Actions',
      action: () => {
        onClose();
        if (onOpenScanAndPay) onOpenScanAndPay();
      },
    },
    {
      id: 'cmd-quick-log',
      title: '1-Second Quick Numpad',
      subtitle: 'Fastest way to log chai, vadapav, auto & daily micro-spends',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      shortcut: 'N',
      category: 'Actions',
      action: () => {
        onClose();
        if (onOpenQuickLog) onOpenQuickLog();
      },
    },
    {
      id: 'cmd-reconcile',
      title: 'Reconcile Bank / UPI Lite Balance',
      subtitle: 'Detect and auto-adjust unaccounted micro-spends against real bank balance',
      icon: <Scale className="w-4 h-4 text-cyan-500" />,
      shortcut: 'R',
      category: 'Actions',
      action: () => {
        onClose();
        if (onOpenReconcile) onOpenReconcile();
      },
    },
    {
      id: 'cmd-add',
      title: 'Add Transaction',
      subtitle: 'Log an income or expense manually with category and split',
      icon: <Plus className="w-4 h-4 text-emerald-500" />,
      shortcut: 'A',
      category: 'Actions',
      action: () => {
        onClose();
        onOpenAdd();
      },
    },
    {
      id: 'cmd-voice',
      title: 'Speak Expense (Voice NLP)',
      subtitle: 'Hands-free voice recognition: "Spent 250 on groceries"',
      icon: <Mic className="w-4 h-4 text-cyan-500 animate-pulse" />,
      shortcut: 'V',
      category: 'Actions',
      action: () => {
        onClose();
        onOpenVoice();
      },
    },
    {
      id: 'cmd-import',
      title: 'Import Bank / GPay Statement',
      subtitle: 'Universal CSV / PDF statement reconciliation with deduplication',
      icon: <FileSpreadsheet className="w-4 h-4 text-blue-500" />,
      shortcut: 'I',
      category: 'Actions',
      action: () => {
        onClose();
        onOpenImport();
      },
    },
    {
      id: 'cmd-sms',
      title: 'Paste SMS / UPI Notification',
      subtitle: 'Parse debit/credit SMS strings instantly into structured ledger',
      icon: <MessageSquareText className="w-4 h-4 text-purple-500" />,
      shortcut: 'P',
      category: 'Actions',
      action: () => {
        onClose();
        onOpenQuickPaste();
      },
    },
    {
      id: 'cmd-nav-dash',
      title: 'Go to Dashboard',
      subtitle: 'Safe-to-Spend, balance metrics and daily cash velocity',
      icon: <LayoutDashboard className="w-4 h-4 text-slate-500" />,
      shortcut: '1',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('dashboard');
      },
    },
    {
      id: 'cmd-nav-txns',
      title: 'Go to Activity & Transactions',
      subtitle: 'Full ledger feed, search, filter and categorize',
      icon: <Receipt className="w-4 h-4 text-slate-500" />,
      shortcut: '2',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('transactions');
      },
    },
    {
      id: 'cmd-nav-splits',
      title: 'Go to Splits & IOU Recovery Hub',
      subtitle: 'Sarcastic reminder studio, debtor leaderboard & settle debt',
      icon: <Users className="w-4 h-4 text-cyan-500" />,
      shortcut: 'S',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('splits');
      },
    },
    {
      id: 'cmd-nav-analytics',
      title: 'Go to Analytics & Trends',
      subtitle: 'Burn rate, cash flow curves and category spending breakdown',
      icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
      shortcut: '3',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('analytics');
      },
    },
    {
      id: 'cmd-nav-savings',
      title: 'Go to Savings Goals',
      subtitle: 'Target milestones, progress tracking and deposit logs',
      icon: <PiggyBank className="w-4 h-4 text-amber-500" />,
      shortcut: '4',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('savings');
      },
    },
    {
      id: 'cmd-nav-settings',
      title: 'Go to Settings & Vault',
      subtitle: 'Security PIN, parent links, webhook tokens and cloud sync',
      icon: <Settings className="w-4 h-4 text-slate-500" />,
      shortcut: '5',
      category: 'Navigation',
      action: () => {
        onClose();
        onNavigate('settings');
      },
    },
    {
      id: 'cmd-lock',
      title: 'Lock Money Flow Vault',
      subtitle: 'Clear unlock session and immediately lock with PIN / biometric',
      icon: <Lock className="w-4 h-4 text-rose-500" />,
      shortcut: 'L',
      category: 'Security',
      action: () => {
        onClose();
        onLockApp();
      },
    },
  ], [onClose, onOpenAdd, onOpenVoice, onOpenImport, onOpenQuickPaste, onNavigate, onLockApp]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commandItems;
    const q = query.toLowerCase().trim();
    return commandItems.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.shortcut?.toLowerCase() === q
    );
  }, [commandItems, query]);

  // Filter matching transactions by merchant/note/amount
  const matchingTxns = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    return transactions
      .filter((t) => {
        return (
          t.merchant.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          t.amount.toString().includes(q)
        );
      })
      .slice(0, 5);
  }, [transactions, query]);

  const totalInteractiveItems = filteredCommands.length + matchingTxns.length;

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalInteractiveItems));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalInteractiveItems) % Math.max(1, totalInteractiveItems));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex < filteredCommands.length) {
          filteredCommands[selectedIndex]?.action();
        } else {
          // Go to transactions tab
          onClose();
          onNavigate('transactions');
        }
        return;
      }

      // Check single-key hotkey if input is empty
      if (!query.trim() && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const keyUpper = e.key.toUpperCase();
        const matched = commandItems.find((c) => c.shortcut === keyUpper);
        if (matched) {
          e.preventDefault();
          matched.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, matchingTxns, totalInteractiveItems, query, commandItems, onClose, onNavigate]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center p-3 sm:p-4 pt-[10vh] sm:pt-[12vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200/90 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, hotkey (A, V, 1-5), or search spends..."
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none min-w-0"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500 font-semibold">
                ESC
              </kbd>
            </div>
          )}
        </div>

        {/* List of Results */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Commands section */}
          {filteredCommands.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Commands & Shortcuts
              </div>
              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-white dark:bg-slate-800 border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        {cmd.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold truncate">{cmd.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{cmd.subtitle}</p>
                      </div>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Matching Transactions section */}
          {matchingTxns.length > 0 && (
            <div className="space-y-0.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Matching Transactions ({matchingTxns.length})
              </div>
              {matchingTxns.map((txn, idx) => {
                const txnIndex = filteredCommands.length + idx;
                const isSelected = txnIndex === selectedIndex;
                const isIncome = txn.type === 'income';

                return (
                  <button
                    key={txn.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('transactions');
                    }}
                    onMouseEnter={() => setSelectedIndex(txnIndex)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{txn.merchant}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {formatISTDate(txn.timestamp)} {txn.notes ? `• ${txn.notes}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold shrink-0 ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredCommands.length === 0 && matchingTxns.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for &quot;add&quot;, &quot;analytics&quot;, &quot;import&quot;, or a merchant name.</p>
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <span>Money Flow Quick Action</span>
        </div>
      </div>
    </div>
  );
}
