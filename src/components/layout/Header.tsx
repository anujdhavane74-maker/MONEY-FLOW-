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
  Settings as SettingsIcon,
} from 'lucide-react';
import { promptPWAInstall, isPWAInstalled } from '@/lib/pwa';
import { useTheme, Theme } from '@/lib/theme';
import { TabType } from '@/components/layout/BottomNav';

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
    { id: 'savings', label: 'Savings', icon: <PiggyBank className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-3 select-none transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Connection Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-sm">
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-lg font-mono">₹</span>
            </div>
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                isOnline ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 dark:bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Money Flow
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                PWA
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-600 dark:text-amber-400">Offline Ready</span>
                  </>
                )}
              </span>
              <span>•</span>
              <span className="text-slate-400 dark:text-slate-500">IST Asia/Kolkata</span>
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

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Hands-Free Voice Input Button */}
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              type="button"
              className="px-2.5 py-1.5 min-h-[38px] rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              title="Speak Expense (Voice NLP)"
            >
              <Mic className="w-3.5 h-3.5 animate-pulse text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">Voice</span>
            </button>
          )}

          {/* Install PWA Prompt Button */}
          {canInstall && (
            <button
              onClick={handleInstallClick}
              type="button"
              className="px-2.5 py-1.5 min-h-[38px] rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Install Money Flow App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install</span>
            </button>
          )}

          {/* Theme Switcher Toggle */}
          <button
            onClick={cycleTheme}
            type="button"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95"
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

          {/* Parent Share View Access */}
          <button
            onClick={onOpenParentShare}
            type="button"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center justify-center transition-colors"
            title="Parent Share View"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* PIN Lock Settings */}
          <button
            onClick={onOpenPinSettings}
            type="button"
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
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
            className="px-3 py-1.5 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all active:scale-95"
            title="Lock App Now"
          >
            <Lock className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span className="hidden xs:inline">Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
