'use client';

import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  PiggyBank,
  Settings,
  Plus,
  Mic,
  FileSpreadsheet,
  Lock,
  LogOut,
  Sun,
  Moon,
  Laptop,
  Command,
  ShieldCheck,
  Wifi,
  WifiOff,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { TabType } from './BottomNav';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';
import { getActiveCurrency } from '@/lib/formatters';

interface DesktopSidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAddModal: () => void;
  onOpenVoiceModal: () => void;
  onOpenImportModal: () => void;
  onOpenCommandPalette: () => void;
  onLockApp: () => void;
  uncategorizedCount?: number;
  pendingIousCount?: number;
  isOnline?: boolean;
}

export function DesktopSidebar({
  activeTab,
  onChangeTab,
  onOpenAddModal,
  onOpenVoiceModal,
  onOpenImportModal,
  onOpenCommandPalette,
  onLockApp,
  uncategorizedCount = 0,
  pendingIousCount = 0,
  isOnline = true,
}: DesktopSidebarProps) {
  const { user, signOut, isConfigured } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const curProfile = getActiveCurrency();

  const navItems = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'transactions' as TabType,
      label: 'Activity',
      icon: Receipt,
      badge: uncategorizedCount > 0 ? uncategorizedCount : null,
    },
    {
      id: 'splits' as TabType,
      label: 'Splits & IOUs',
      icon: Users,
      badge: pendingIousCount > 0 ? pendingIousCount : null,
      isCyanBadge: true,
    },
    {
      id: 'analytics' as TabType,
      label: 'Analytics & Trends',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'savings' as TabType,
      label: 'Savings Goals',
      icon: PiggyBank,
      badge: null,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="hidden lg:flex w-64 h-screen sticky top-0 flex-col bg-white dark:bg-slate-950 border-r border-slate-200/90 dark:border-slate-800/80 shrink-0 select-none z-30 transition-colors">
      {/* Brand Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-xs">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-lg font-mono">
                {curProfile.symbol}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-base">
                  Money Flow
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                  VAULT
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {curProfile.code} ({curProfile.symbol})
              </p>
            </div>
          </div>
        </div>

        {/* Cmd+K Quick Launch Pill */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors text-xs font-medium"
        >
          <span className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5 text-slate-500" />
            <span>Quick search...</span>
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500 font-bold">
            ⌘K
          </kbd>
        </button>

        {/* Quick Add Action Button */}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm shadow-emerald-500/20 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Main Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  item.isCyanBadge
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'bg-amber-500 text-slate-950 animate-pulse'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Shortcuts
        </div>
        <button
          type="button"
          onClick={onOpenVoiceModal}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors"
        >
          <Mic className="w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-pulse" />
          <span>Speak Expense (NLP)</span>
        </button>
        <button
          type="button"
          onClick={onOpenImportModal}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Import CSV / PDF</span>
        </button>
      </nav>

      {/* Footer Controls & User Account */}
      <div className="p-3 border-t border-slate-200/90 dark:border-slate-800/80 space-y-2">
        {/* User Profile Card */}
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
              {user?.email ? user.email.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.email || 'Fintech Vault User'}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  {isOnline ? (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ) : (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                <span>•</span>
                <span className="truncate">{curProfile.code}</span>
              </div>
            </div>
          </div>

          {/* Quick Lock Button */}
          <button
            type="button"
            onClick={onLockApp}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            title="Lock Vault Now"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Utility Actions Row */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="text-[11px] capitalize">{resolvedTheme}</span>
          </button>

          {user && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Sign out from your Money Flow account on this device?')) {
                  signOut();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-[11px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
