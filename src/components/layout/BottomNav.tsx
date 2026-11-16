'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  PiggyBank,
  Settings,
  Sparkles,
  FileSpreadsheet,
  MessageSquareText,
  X,
  Mic,
} from 'lucide-react';

export type TabType = 'dashboard' | 'transactions' | 'savings' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAddModal: () => void;
  onOpenImportModal: () => void;
  onOpenQuickPasteModal: () => void;
  onOpenVoiceModal?: () => void;
  uncategorizedCount?: number;
}

export function BottomNav({
  activeTab,
  onChangeTab,
  onOpenAddModal,
  onOpenImportModal,
  onOpenQuickPasteModal,
  onOpenVoiceModal,
  uncategorizedCount = 0,
}: BottomNavProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <>
      {/* Central Quick Action Dropup Overlay */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fade-in flex flex-col justify-end p-4 pb-24"
          onClick={() => setShowAddMenu(false)}
        >
          <div
            className="w-full max-w-sm mx-auto rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl space-y-2 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Log or Ingest Money
              </span>
              <button
                onClick={() => setShowAddMenu(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 0: Speak Expense (Voice NLP) */}
            {onOpenVoiceModal && (
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  onOpenVoiceModal();
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-800/80 hover:bg-slate-800 border border-cyan-800/50 flex items-center gap-3.5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-white">Speak Expense (Voice NLP)</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                      Zero Friction
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">&ldquo;Spent 120 on cold coffee&rdquo;</p>
                </div>
              </button>
            )}

            {/* Option 1: Manual Transaction */}
            <button
              onClick={() => {
                setShowAddMenu(false);
                onOpenAddModal();
              }}
              className="w-full p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-3.5 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Add Manual Transaction</p>
                <p className="text-xs text-slate-400">Expense, income, or split with friends</p>
              </div>
            </button>

            {/* Option 2: Quick SMS / Notification Paste */}
            <button
              onClick={() => {
                setShowAddMenu(false);
                onOpenQuickPasteModal();
              }}
              className="w-full p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-3.5 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <MessageSquareText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Paste Bank SMS / Notification</p>
                <p className="text-xs text-slate-400">Auto-parse amount, UPI Ref, and merchant</p>
              </div>
            </button>

            {/* Option 3: Import GPay CSV / PDF */}
            <button
              onClick={() => {
                setShowAddMenu(false);
                onOpenImportModal();
              }}
              className="w-full p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-3.5 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Import Statement (CSV / PDF)</p>
                <p className="text-xs text-slate-400">Google Pay reconciliation with deduplication</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-2 select-none">
        <div className="max-w-md mx-auto flex items-center justify-around relative">
          {/* Dashboard Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('dashboard')}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-1">Dashboard</span>
          </button>

          {/* Transactions Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('transactions')}
            className={`flex flex-col items-center justify-center w-16 py-1 relative transition-all ${
              activeTab === 'transactions'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px] mt-1">Activity</span>
            {uncategorizedCount > 0 && (
              <span className="absolute top-0 right-3 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center animate-pulse">
                {uncategorizedCount}
              </span>
            )}
          </button>

          {/* Prominent Elevated Central Add Button */}
          <div className="relative -top-5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 hover:brightness-110 active:scale-95 shadow-lg shadow-emerald-500/25 flex items-center justify-center text-slate-950 font-bold transition-transform p-3.5"
              aria-label="Add or Import"
            >
              <Plus className={`w-6 h-6 transition-transform duration-200 ${showAddMenu ? 'rotate-45' : ''}`} />
            </button>
          </div>

          {/* Savings Goals Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('savings')}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'savings'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-5 h-5" />
            <span className="text-[10px] mt-1">Savings</span>
          </button>

          {/* Settings Tab */}
          <button
            type="button"
            onClick={() => onChangeTab('settings')}
            className={`flex flex-col items-center justify-center w-16 py-1 transition-all ${
              activeTab === 'settings'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-1">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
}
