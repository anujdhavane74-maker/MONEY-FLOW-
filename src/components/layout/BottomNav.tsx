'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  PiggyBank,
  Settings,
  FileSpreadsheet,
  MessageSquareText,
  X,
  Mic,
  TrendingUp,
  Users,
  QrCode,
  Zap,
} from 'lucide-react';

export type TabType = 'dashboard' | 'transactions' | 'splits' | 'analytics' | 'savings' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAddModal: () => void;
  onOpenScanAndPayModal?: () => void;
  onOpenQuickLogSheet?: () => void;
  onOpenImportModal: () => void;
  onOpenQuickPasteModal: () => void;
  onOpenVoiceModal?: () => void;
  uncategorizedCount?: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  onOpenAddModal,
  onOpenScanAndPayModal,
  onOpenQuickLogSheet,
  onOpenImportModal,
  onOpenQuickPasteModal,
  onOpenVoiceModal,
  uncategorizedCount = 0,
}: BottomNavProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <>
      {/* Central Quick Action Bottom Sheet Overlay */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in flex flex-col justify-end"
          onClick={() => setShowAddMenu(false)}
        >
          <div
            className="w-full max-w-lg mx-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl flex flex-col max-h-[75dvh] mt-14 overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Pill */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quick Actions
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Money Flow
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMenu(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Close action menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Sheet Content */}
            <div className="overflow-y-auto px-4 py-3 space-y-3 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
              {/* Top Hero Grid (2 Columns, grid-cols-2 gap-2.5) */}
              <div className="grid grid-cols-2 gap-2.5 min-w-0">
                {/* 1. Scan & Pay UPI */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    if (onOpenScanAndPayModal) onOpenScanAndPayModal();
                    else onOpenAddModal();
                  }}
                  className="group relative p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/45 border border-emerald-200/80 dark:border-emerald-800/40 text-left transition-all active:scale-[0.98] min-w-0 flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <QrCode className="w-4.5 h-4.5 animate-pulse" />
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      Auto-Log
                    </span>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Scan & Pay UPI
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Camera QR Scanner
                    </p>
                  </div>
                </button>

                {/* 2. Quick Numpad */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    if (onOpenQuickLogSheet) onOpenQuickLogSheet();
                    else onOpenAddModal();
                  }}
                  className="group relative p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/25 dark:hover:bg-amber-950/45 border border-amber-200/80 dark:border-amber-800/40 text-left transition-all active:scale-[0.98] min-w-0 flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                      <Zap className="w-4.5 h-4.5" />
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      Chai & Auto
                    </span>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Quick Numpad
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      1.5s Micro-Spend
                    </p>
                  </div>
                </button>

                {/* 3. Voice Expense */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    if (onOpenVoiceModal) onOpenVoiceModal();
                    else onOpenAddModal();
                  }}
                  className="group relative p-3 rounded-2xl bg-cyan-50/70 hover:bg-cyan-100/80 dark:bg-cyan-950/25 dark:hover:bg-cyan-950/45 border border-cyan-200/80 dark:border-cyan-800/40 text-left transition-all active:scale-[0.98] min-w-0 flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                      <Mic className="w-4.5 h-4.5" />
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                      Hands-Free
                    </span>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Voice Expense
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Hands-Free NLP
                    </p>
                  </div>
                </button>

                {/* 4. Add Manual */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onOpenAddModal();
                  }}
                  className="group relative p-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/25 dark:hover:bg-indigo-950/45 border border-indigo-200/80 dark:border-indigo-800/40 text-left transition-all active:scale-[0.98] min-w-0 flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-center justify-between gap-1 w-full min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Plus className="w-4.5 h-4.5" />
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                      Manual
                    </span>
                  </div>
                  <div className="mt-2.5 min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Add Manual
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Expense or Income
                    </p>
                  </div>
                </button>
              </div>

              {/* Secondary Compact Action Rows (Single-line h-12 rows below the grid) */}
              <div className="space-y-2 min-w-0 pt-0.5">
                {/* 5. Splits & IOU Recovery Hub */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onChangeTab('splits');
                  }}
                  className="w-full h-12 px-3 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 transition-all active:scale-[0.99] text-left min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Splits & IOU Recovery Hub
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                    Roast 💸
                  </span>
                </button>

                {/* 6. Import GPay CSV / PDF */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onOpenImportModal();
                  }}
                  className="w-full h-12 px-3 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 transition-all active:scale-[0.99] text-left min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Import GPay CSV / PDF
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Statements
                  </span>
                </button>

                {/* 7. Paste Bank SMS / Alert */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    onOpenQuickPasteModal();
                  }}
                  className="w-full h-12 px-3 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 transition-all active:scale-[0.99] text-left min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <MessageSquareText className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Paste Bank SMS / Alert
                    </span>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    Instant Parse
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (Hidden on desktop lg:hidden) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/80 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none transition-colors">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center relative">
          {/* 1. Home Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('dashboard')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-all ${
              activeTab === 'dashboard'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">Home</span>
          </button>

          {/* 2. History Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('transactions')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 relative transition-all ${
              activeTab === 'transactions'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">History</span>
            {uncategorizedCount > 0 && (
              <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
                {uncategorizedCount}
              </span>
            )}
          </button>

          {/* 3. Prominent Elevated Central Add Button */}
          <div className="relative -top-4 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25 flex items-center justify-center text-slate-950 font-bold transition-transform p-3 min-w-[44px] min-h-[44px]"
              aria-label="Add or Ingest"
            >
              <Plus className={`w-6 h-6 transition-transform duration-200 ${showAddMenu ? 'rotate-45' : ''}`} />
            </button>
          </div>

          {/* 4. Analytics / Trends Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('analytics')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-all ${
              activeTab === 'analytics'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">Trends</span>
          </button>

          {/* 5. Settings Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('settings')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-1 transition-all ${
              activeTab === 'settings'
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[11px] mt-0.5">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
}
