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
} from 'lucide-react';
import { AppSettings, MerchantRule, Category, Transaction } from '@/lib/types';
import { db } from '@/lib/db';
import { generateSecureToken } from '@/lib/crypto';
import { MacroDroidGuideModal } from './MacroDroidGuideModal';
import { DataBackupCard } from './DataBackupCard';
import { useTheme, Theme } from '@/lib/theme';

interface SettingsViewProps {
  settings: AppSettings | null;
  categories: Category[];
  merchantRules: MerchantRule[];
  onOpenPinSettings: () => void;
  onRefresh: () => void;
  onSimulateWebhook?: (txn: Transaction) => void;
}

export const SettingsView = memo(function SettingsView({
  settings,
  categories,
  merchantRules,
  onOpenPinSettings,
  onRefresh,
  onSimulateWebhook,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'share' | 'webhook' | 'rules' | 'data'>(
    'security'
  );

  const { theme, setTheme } = useTheme();

  // Parent Link Creator State
  const [newShareLabel, setNewShareLabel] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // MacroDroid Modal
  const [showMacroModal, setShowMacroModal] = useState(false);

  // New Merchant Rule State
  const [newKeyword, setNewKeyword] = useState('');
  const [newRuleCatId, setNewRuleCatId] = useState(categories[0]?.id || 'cat-food');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Theme / Appearance Quick Switcher Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appearance & Theme</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-contrast tokens designed for readability in bright sunlight and dark environments
            </p>
          </div>
        </div>

        {/* 3-way Theme Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold transition-all ${
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: 'security', label: 'Security & PIN', icon: KeyRound },
          { key: 'share', label: 'Parent Share Links', icon: Share2 },
          { key: 'webhook', label: 'MacroDroid & Webhook', icon: Smartphone },
          { key: 'rules', label: 'Auto-Tagging Rules', icon: Brain },
          { key: 'data', label: 'Backup & Vault', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2.5 min-h-[44px] rounded-2xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Security & PIN Tab */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-5 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">4-Digit Security PIN & Inactivity Lock</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
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
                    ? `Encrypted PBKDF2 / SHA-256 hash stored with per-device salt. Auto-locks after ${settings?.autoLockMinutes || 5} min of idle time.`
                    : 'We recommend setting a 4-digit code to protect your personal financial records.'}
                </p>
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

      {/* 3. MacroDroid / Tasker Webhook Guide */}
      {activeTab === 'webhook' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800/80 shadow-sm dark:shadow-lg space-y-5 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                Automated SMS Sync Bridge (MacroDroid / Tasker)
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
