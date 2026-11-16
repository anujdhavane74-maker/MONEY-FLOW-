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
  KeyRound,
  Mic,
} from 'lucide-react';
import { promptPWAInstall, isPWAInstalled } from '@/lib/pwa';

interface HeaderProps {
  onLockApp: () => void;
  isPinEnabled: boolean;
  onOpenPinSettings: () => void;
  onOpenParentShare: () => void;
  onOpenVoiceModal?: () => void;
  uncategorizedCount?: number;
}

export function Header({
  onLockApp,
  isPinEnabled,
  onOpenPinSettings,
  onOpenParentShare,
  onOpenVoiceModal,
  uncategorizedCount = 0,
}: HeaderProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(true);

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

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 select-none">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Logo & Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-950/40">
              <span className="font-extrabold text-emerald-400 text-lg font-mono">₹</span>
            </div>
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Money Flow
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                PWA
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="text-slate-400">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400 font-medium">Offline Ready</span>
                  </>
                )}
              </span>
              <span>•</span>
              <span className="text-slate-500">IST Asia/Kolkata</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Hands-Free Voice Input Button */}
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              type="button"
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              title="Speak Expense (Voice NLP)"
            >
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">Voice</span>
            </button>
          )}

          {/* Install PWA Prompt Button */}
          {canInstall && (
            <button
              onClick={handleInstallClick}
              type="button"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Install Money Flow App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Parent Share View Access */}
          <button
            onClick={onOpenParentShare}
            type="button"
            className="w-9 h-9 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-colors"
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
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-emerald-400'
                : 'bg-amber-950/20 border-amber-800/40 text-amber-400 hover:bg-amber-900/30'
            }`}
            title={isPinEnabled ? 'PIN Security Active' : 'Setup PIN Protection'}
          >
            {isPinEnabled ? <ShieldCheck className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
          </button>

          {/* Quick Lock Button */}
          <button
            onClick={onLockApp}
            type="button"
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-all active:scale-95"
            title="Lock App Now"
          >
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xs:inline">Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
