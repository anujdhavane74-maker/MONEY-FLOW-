'use client';

import React, { useState, memo } from 'react';
import {
  KeyRound,
  Share2,
  Brain,
  Database,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Trash2,
  Plus,
  Check,
  ExternalLink,
  Smartphone,
  EyeOff,
  Sun,
  Moon,
  Laptop,
  Palette,
  Fingerprint,
  Globe,
  User,
  LogOut,
  CheckCircle2,
  QrCode,
  Scale,
} from 'lucide-react';
import { AppSettings, MerchantRule, Category, Transaction } from '@/lib/types';
import { db } from '@/lib/db';
import { generateSecureToken } from '@/lib/crypto';
import { isBiometricEnrolled } from '@/lib/sessionAuth';
import { MacroDroidGuideModal } from './MacroDroidGuideModal';
import { DataBackupCard } from './DataBackupCard';
import { useTheme, Theme } from '@/lib/theme';
import { useAuth } from '@/lib/authContext';
import { CURRENCY_LIST, CurrencyCode, setActiveCurrency, getActiveCurrency } from '@/lib/formatters';

interface SettingsViewProps {
  settings: AppSettings | null;
  categories: Category[];
  merchantRules: MerchantRule[];
  onOpenPinSettings: () => void;
  onRefresh: () => void;
  onOpenReconcile?: () => void;
  onSimulateWebhook?: (txn: Transaction) => void;
}

export const SettingsView = memo(function SettingsView({
  settings,
  categories,
  merchantRules,
  onOpenPinSettings,
  onRefresh,
  onOpenReconcile,
  onSimulateWebhook,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'share' | 'webhook' | 'rules' | 'data'>(
    'account'
  );

  const { user, signOut, isConfigured } = useAuth();
  const { theme, setTheme } = useTheme();

  // Parent Link Creator State
  const [newShareLabel, setNewShareLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // MacroDroid Modal
  const [showMacroModal, setShowMacroModal] = useState(false);

  // New Merchant Rule State
  const [newKeyword, setNewKeyword] = useState('');
  const [newRuleCatId, setNewRuleCatId] = useState(categories[0]?.id || 'cat-food');

  // UPI State for Sarcastic IOU Cards
  const [upiInput, setUpiInput] = useState(settings?.upiId || '');
  const [upiSaved, setUpiSaved] = useState(false);

  const originUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'https://money-flow-lac.vercel.app');
  const apiKey = settings?.apiKey || '';

  const handleRotateApiKey = async () => {
    if (!confirm('Rotate your webhook secret key? You will need to update the X-API-Key header in MacroDroid / Tasker.')) return;
    const newKey = generateSecureToken(32);
    await db.app_settings.update('global', { apiKey: newKey });
    onRefresh();
  };

  const handleCreateShareToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShareLabel.trim()) return;

    const token = generateSecureToken(24);
    const newTokenObj = {
      token,
      label: newShareLabel.trim(),
      createdAt: Date.now(),
      revoked: false,
    };

    const currentTokens = settings?.parentShareTokens || [];
    await db.app_settings.update('global', {
      parentShareTokens: [...currentTokens, newTokenObj],
    });

    setNewShareLabel('');
    onRefresh();
  };

  const handleRevokeShareToken = async (tokenStr: string) => {
    if (!settings) return;
    const updated = (settings.parentShareTokens || []).map((t) =>
      t.token === tokenStr ? { ...t, revoked: true } : t
    );
    await db.app_settings.update('global', { parentShareTokens: updated });
    onRefresh();
  };

  const handleCopyLink = (token: string) => {
    const fullUrl = `${originUrl}/share/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleToggleHideNotes = async (checked: boolean) => {
    await db.app_settings.update('global', { hideNotesFromParent: checked });
    onRefresh();
  };

  const handleAddMerchantRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    await db.merchant_rules.add({
      id: `rule-${Date.now()}`,
      keyword: newKeyword.trim().toLowerCase(),
      categoryId: newRuleCatId,
      confidence: 1.0,
      createdAt: Date.now(),
    });

    setNewKeyword('');
    onRefresh();
  };

  const handleDeleteRule = async (id: string) => {
    await db.merchant_rules.delete(id);
    onRefresh();
  };

  const isPinActive = Boolean(settings?.pinEnabled && settings?.pinHash);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-4xl mx-auto min-w-0 w-full overflow-hidden">
      {/* Theme / Appearance Quick Switcher Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-colors min-w-0 w-full overflow-hidden">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">Appearance & Theme</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Adaptive WCAG AA+ contrast for high readability
            </p>
          </div>
        </div>

        {/* 3-way Theme Pills */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shrink-0 self-start sm:self-auto">
          {(
            [
              { key: 'light', label: 'Light', icon: Sun },
              { key: 'dark', label: 'Dark', icon: Moon },
              { key: 'system', label: 'System', icon: Laptop },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTheme(t.key)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200/60 dark:border-slate-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800 w-full max-w-full min-w-0 snap-x">
        {[
          { key: 'account', label: 'Account & Currency', icon: Globe },
          { key: 'security', label: 'Security & PIN', icon: KeyRound },
          { key: 'share', label: 'Parent Links', icon: Share2 },
          { key: 'webhook', label: 'Advanced Webhook', icon: Smartphone },
          { key: 'rules', label: 'Auto-Rules', icon: Brain },
          { key: 'data', label: 'Backup & Vault', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`snap-start px-3 sm:px-3.5 py-2 min-h-[40px] rounded-2xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 0. Account & Multi-Currency Tab */}
      {activeTab === 'account' && (
        <div className="space-y-4 sm:space-y-6">
          {/* User Account / Multi-Tenant Session Card */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-4 transition-colors min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-extrabold text-base shrink-0">
                  {user?.email ? user.email.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {user?.email || 'Offline Guest Vault'}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user
                      ? `Multi-tenant cloud account • ID: ${user.id.slice(0, 8)}...`
                      : 'Local storage session. Create an account to sync across devices.'}
                  </p>
                </div>
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Sign out from Money Flow on this device? Your local cache will be cleared safely.')) {
                      signOut();
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <a
                  href="/login"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 self-start sm:self-auto"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In / Register</span>
                </a>
              )}
            </div>
          </div>

          {/* Active Global Currency Selector */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-4 transition-colors min-w-0 w-full">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Active Global Currency
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Switch currencies dynamically. All Safe-to-Spend limits, charts, and transaction feeds adapt instantly.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {CURRENCY_LIST.map((cur) => {
                const currentCode = settings?.currency || 'INR';
                const isSelected = currentCode === cur.code;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={async () => {
                      setActiveCurrency(cur.code);
                      await db.app_settings.update('global', { currency: cur.code });
                      onRefresh();
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        {cur.symbol}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <p className="text-xs font-bold leading-tight truncate">{cur.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{cur.code}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sarcastic IOU Cards & Quick Repayment UPI ID */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-3.5 transition-colors min-w-0 w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Your UPI ID (For Sarcastic IOU Cards & QR Badges)
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Embedded automatically onto shared prescription pads, bank notices, and meme receipts so friends can repay you instantly.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="e.g. anuj@okhdfcbank or 9823000000@paytm"
                value={upiInput}
                onChange={(e) => {
                  setUpiInput(e.target.value);
                  setUpiSaved(false);
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={async () => {
                  await db.app_settings.update('global', { upiId: upiInput.trim() });
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('mf_user_upi_id', upiInput.trim());
                  }
                  setUpiSaved(true);
                  onRefresh();
                  setTimeout(() => setUpiSaved(false), 2500);
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs shrink-0"
              >
                {upiSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save UPI ID</span>
                )}
              </button>
            </div>
          </div>

          {/* Balance Reconciliation Card */}
          {onOpenReconcile && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-3 transition-colors min-w-0 w-full">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    Reconcile Bank / UPI Lite Balance
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Compare your actual bank balance against Money Flow to catch unlogged chai, auto, and cash micro-spends.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenReconcile}
                  className="px-4 py-2 min-h-[38px] rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Scale className="w-4 h-4" />
                  <span>Open Balance Reconciler</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Security & PIN Tab */}
      {activeTab === 'security' && (
        <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-4 sm:space-y-5 transition-colors min-w-0 w-full overflow-hidden">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">4-Digit Security PIN & Inactivity Lock</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                Prevents unauthorized access when lending your phone or browsing in public
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPinSettings}
              className="px-4 py-2 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {isPinActive ? 'Manage PIN' : 'Set Up PIN'}
            </button>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isPinActive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {isPinActive ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {isPinActive ? 'PIN Security Active' : 'No PIN Set'}
                </p>
                <p className="text-xs opacity-90">
                  {isPinActive
                    ? `Encrypted PBKDF2 / SHA-256 hash. Auto-locks after ${
                        settings?.autoLockMinutes === 0
                          ? 'Never (manual lock only)'
                          : `${settings?.autoLockMinutes ?? 5} min of inactivity`
                      }.`
                    : 'We recommend setting a 4-digit code to protect your personal financial records.'}
                </p>
                {isPinActive && isBiometricEnrolled() && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Fingerprint / Face ID Quick Unlock active on this device</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Parent Share Links Tab */}
      {activeTab === 'share' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-5 transition-colors">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Parent Share Links (Read-Only)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate unique, tokenized URLs for parents or guardians. They can view spending breakdowns without editing privileges.
            </p>
          </div>

          {/* Privacy Toggle: Hide Transaction Notes from Parent View */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <EyeOff className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200">
                  Hide Transaction Notes from Parent View
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Keeps personal notes and descriptions private while showing clean amounts & categories.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(settings?.hideNotesFromParent)}
              onChange={(e) => handleToggleHideNotes(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
            />
          </div>

          {/* Create Token Form */}
          <form onSubmit={handleCreateShareToken} className="flex gap-2">
            <input
              type="text"
              placeholder="Label e.g. 'Mom & Dad View', 'Hostel Guardian'"
              value={newShareLabel}
              onChange={(e) => setNewShareLabel(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              required
            />
            <button
              type="submit"
              className="px-4 py-2.5 min-h-[40px] rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Generate Link
            </button>
          </form>

          {/* Tokens List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {(settings?.parentShareTokens || []).length === 0 ? (
              <p className="p-6 text-xs text-slate-400 dark:text-slate-500 text-center">
                No parent share links generated yet.
              </p>
            ) : (
              (settings?.parentShareTokens || []).map((t) => (
                <div
                  key={t.token}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          t.revoked
                            ? 'bg-rose-100 border border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-400'
                            : 'bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-400'
                        }`}
                      >
                        {t.revoked ? 'Revoked' : 'Active'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all">
                      {originUrl}/share/{t.token}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!t.revoked && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(t.token)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          {copiedToken === t.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                              Copy Link
                            </>
                          )}
                        </button>
                        <a
                          href={`/share/${t.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          title="Open preview"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRevokeShareToken(t.token)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors"
                          title="Revoke access"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. Advanced Webhook (Optional / Legacy SMS forwarder) */}
      {activeTab === 'webhook' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-5 transition-colors">
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
            <strong>💡 Pro-tip for Indian users:</strong> Indian banks no longer send SMS alerts for small transactions under ₹50. Use the native <strong>Scan & Pay UPI</strong> launcher or <strong>1-Sec Quick Numpad</strong> on your Home Screen for daily zero-friction capture! This webhook remains available for automated high-value SMS forwarding.
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Advanced SMS Webhook Bridge (Optional)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Forwards bank SMS and UPI notifications in real-time with timing-safe webhook authentication.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMacroModal(true)}
              className="px-3.5 py-2 min-h-[38px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Smartphone className="w-4 h-4" />
              Setup Guide & Test
            </button>
          </div>

          {/* Endpoint Details Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                Webhook Endpoint:
              </span>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 font-mono text-xs text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-transparent truncate">
                {originUrl}/api/ingest-sms
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                  X-API-Key Header:
                </span>
                <button
                  type="button"
                  onClick={handleRotateApiKey}
                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 underline font-semibold"
                >
                  Rotate Key
                </button>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-950 font-mono text-xs text-cyan-800 dark:text-cyan-300 border border-slate-200 dark:border-transparent truncate">
                {apiKey || 'No key configured. Click Rotate to generate.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Smart Auto-Categorization Rules Tab */}
      {activeTab === 'rules' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-4 transition-colors">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Learned Merchant Auto-Tagging Rules ({merchantRules.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Whenever you categorize a merchant, Money Flow memorizes the mapping so future spends are auto-tagged without prompting.
            </p>
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAddMerchantRule} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Merchant keyword (e.g. 'canteen', 'subway')"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              required
            />
            <select
              value={newRuleCatId}
              onChange={(e) => setNewRuleCatId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 min-h-[38px] rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Rule
            </button>
          </form>

          {/* Rules List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl">
            {merchantRules.map((rule) => {
              const cat = categories.find((c) => c.id === rule.categoryId);
              return (
                <div
                  key={rule.id}
                  className="p-3 flex items-center justify-between text-xs bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{rule.keyword}</span>
                    <span className="text-slate-400 dark:text-slate-500">➔</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">{cat?.name || 'Unknown'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Backup & Vault Tab */}
      {activeTab === 'data' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-5 transition-colors">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Data Management, Cloud Persistence & Backups
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Offline-first architecture with Dexie.js (IndexedDB). Download full snapshots, export spreadsheets, and sync with your cloud webhook database.
            </p>
          </div>

          <DataBackupCard onRefresh={onRefresh} />
        </div>
      )}

      {/* MacroDroid Modal */}
      {showMacroModal && (
        <MacroDroidGuideModal
          apiKey={apiKey}
          onClose={() => setShowMacroModal(false)}
          onSimulated={(txn) => {
            onRefresh();
            if (onSimulateWebhook) onSimulateWebhook(txn);
          }}
        />
      )}
    </div>
  );
});
