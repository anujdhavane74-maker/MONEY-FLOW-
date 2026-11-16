'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Wifi,
  WifiOff,
  Download,
  Share2,
  ShieldCheck,
  Moon,
  Sun,
  Laptop,
  KeyRound,
  Mic,
  LayoutDashboard,
  Receipt,
  PiggyBank,
  TrendingUp,
  Settings as SettingsIcon,
} from 'lucide-react';
import { promptPWAInstall, isPWAInstalled } from '@/lib/pwa';
import { useTheme, Theme } from '@/lib/theme';
import { TabType } from '@/components/layout/BottomNav';
import { getActiveCurrency } from '@/lib/formatters';

interface HeaderProps {
  onLockApp: () => void;
  isPinEnabled: boolean;
  onOpenPinSettings: () => void;
  onOpenParentShare: () => void;
  onOpenVoiceModal?: () => void;
  uncategorizedCount?: number;
  activeTab?: TabType;
  onChangeTab?: (tab: TabType) => void;
}

export function Header({
  onLockApp,
  isPinEnabled,
  onOpenPinSettings,
  onOpenParentShare,
  onOpenVoiceModal,
  uncategorizedCount = 0,
  activeTab = 'dashboard',
  onChangeTab,
}: HeaderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleInstallable = () => setCanInstall(true);
    window.addEventListener('pwa-installable', handleInstallable);

    if (isPWAInstalled()) {
      setCanInstall(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstallClick = async () => {
    const installed = await promptPWAInstall();
    if (installed) setCanInstall(false);
  };

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  const curProfile = getActiveCurrency();

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'transactions',
      label: 'Activity',
      icon: (
        <span className="relative">
          <Receipt className="w-4 h-4" />
          {uncategorizedCount > 0 && (
            <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold flex items-center justify-center animate-pulse">
              {uncategorizedCount}
            </span>
          )}
        </span>
      ),
    },
    { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'savings', label: 'Goals', icon: <PiggyBank className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-6 py-2.5 sm:py-3 h-14 sm:h-16 select-none transition-colors duration-200 flex items-center">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-xs">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base sm:text-lg font-mono">
                {curProfile.symbol}
              </span>
            </div>
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                isOnline ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 dark:bg-amber-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                Money Flow
              </span>
              <span className="hidden xs:inline-flex text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                PWA
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span className="flex items-center gap-1 truncate">
                {isOnline ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-medium text-amber-600 dark:text-amber-400">Offline</span>
                  </>
                )}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500">IST Asia/Kolkata</span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on mobile < 1024px) */}
        {onChangeTab && (
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Action Controls (Clean, single-row on mobile with 40x40px tap targets) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Hands-Free Voice Input Button */}
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              type="button"
              className="w-9 h-9 sm:w-auto sm:px-2.5 sm:py-1.5 min-w-[38px] min-h-[38px] rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              title="Speak Expense (Voice NLP)"
              aria-label="Speak Expense with Voice"
            >
              <Mic className="w-4 h-4 animate-pulse text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">Voice</span>
            </button>
          )}

          {/* Theme Switcher Toggle */}
          <button
            onClick={cycleTheme}
            type="button"
            className="w-9 h-9 min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95"
            title={`Current theme: ${theme} (Click to switch)`}
            aria-label="Toggle light/dark theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 transition-transform rotate-0" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 transition-transform rotate-0" />
              )
            ) : (
              <Sun className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Desktop/Tablet Extended Controls (Hidden on narrow mobile screens) */}
          {canInstall && (
            <button
              onClick={handleInstallClick}
              type="button"
              className="hidden md:flex px-2.5 py-1.5 min-h-[38px] rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Install Money Flow App"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          )}

          <button
            onClick={onOpenParentShare}
            type="button"
            className="hidden md:flex w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 items-center justify-center transition-colors"
            title="Parent Share View"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenPinSettings}
            type="button"
            className={`hidden md:flex w-9 h-9 rounded-xl border items-center justify-center transition-colors ${
              isPinEnabled
                ? 'bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            }`}
            title={isPinEnabled ? 'PIN Security Active' : 'Setup PIN Protection'}
          >
            {isPinEnabled ? <ShieldCheck className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          </button>

          {/* Quick Lock Button */}
          <button
            onClick={onLockApp}
            type="button"
            className="w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 min-w-[38px] min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:white flex items-center justify-center gap-1.5 transition-all active:scale-95"
            title="Lock App Now"
            aria-label="Lock App"
          >
            <Lock className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
