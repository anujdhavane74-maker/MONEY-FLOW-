'use client';

import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  X,
  Layers,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import Papa from 'papaparse';
import { db, clearAllDemoData } from '@/lib/db';
import { formatISTDate, formatISTTime } from '@/lib/formatters';
import { performFullSync, pushToCloud } from '@/lib/sync';
import { sanitizeForCsv } from '@/lib/validations';

interface DataBackupCardProps {
  onRefresh: () => void;
}

interface BackupFileContent {
  app?: string;
  version?: string;
  exportedAt?: string;
  transactions?: any[];
  recurringBills?: any[];
  ious?: any[];
  merchantRules?: any[];
  quickPresets?: any[];
  savingsGoals?: any[];
  categories?: any[];
  appSettings?: any;
}

export function DataBackupCard({ onRefresh }: DataBackupCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // States
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [restoreModalData, setRestoreModalData] = useState<{
    file: BackupFileContent;
    fileName: string;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Reset Demo Data Modal State
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // 1. Cloud Sync Trigger
  const handleCloudSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await performFullSync();
      if (res.success) {
        showToast(
          res.newTransactions.length > 0
            ? `Synced! Pulled ${res.newTransactions.length} new transactions.`
            : 'Cloud state synced successfully.'
        );
        onRefresh();
      } else {
        setSyncMessage(res.error || 'Sync completed with local fallback.');
      }
    } catch (err) {
      setSyncMessage('Unable to reach sync endpoint.');
    } finally {
      setSyncing(false);
    }
  };

  // 2. Export Full Backup (.json)
  const handleExportFullJson = async () => {
    try {
      const transactions = await db.transactions.toArray();
      const recurringBills = await db.recurring_bills.toArray();
      const ious = await db.ious.toArray();
      const merchantRules = await db.merchant_rules.toArray();
      const quickPresets = await db.quick_presets.toArray();
      const savingsGoals = await db.savings_goals.toArray();
      const categories = await db.categories.toArray();
      const appSettings = await db.app_settings.get('global');

      const backupData: BackupFileContent = {
        app: 'Money Flow',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        transactions,
        recurringBills,
        ious,
        merchantRules,
        quickPresets,
        savingsGoals,
        categories,
        appSettings,
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money-flow-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Full JSON backup downloaded safely.');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate full JSON backup.');
    }
  };

  // 3. Export CSV (.csv)
  const handleExportCsv = async () => {
    try {
      const txns = await db.transactions.orderBy('timestamp').reverse().toArray();

      const csvRows = txns.map((t) => ({
        Date: sanitizeForCsv(formatISTDate(t.timestamp)),
        Time: sanitizeForCsv(formatISTTime(t.timestamp)),
        Type: sanitizeForCsv(t.type.toUpperCase()),
        'Amount (INR)': t.amount,
        'My Personal Share (INR)': t.myShareAmount ?? t.amount,
        'Split Total (INR)': t.splitTotalAmount ?? t.amount,
        'Is Split': t.isSplit ? 'YES' : 'NO',
        Category: sanitizeForCsv(t.category),
        Merchant: sanitizeForCsv(t.merchant),
        'Bank / App': sanitizeForCsv(t.bankOrApp || ''),
        'UTR / Ref ID': sanitizeForCsv(t.upiRefId || ''),
        Source: sanitizeForCsv(t.source),
        Categorized: t.isCategorized ? 'YES' : 'NO',
        Notes: sanitizeForCsv(t.notes || ''),
      }));

      const csvString = Papa.unparse(csvRows);
      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money-flow-transactions-${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('Transactions exported to CSV successfully.');
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export transactions CSV.');
    }
  };

  // 4. File Picker Trigger for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BackupFileContent;

        if (!parsed.transactions && !parsed.recurringBills && !parsed.ious) {
          alert('Invalid file format: No Money Flow data collections found in this JSON file.');
          return;
        }

        setRestoreModalData({
          file: parsed,
          fileName: file.name,
        });
      } catch (err) {
        alert('Invalid JSON file. Please select a valid Money Flow backup .json file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 5. Execute Restore
  const handleExecuteRestore = async () => {
    if (!restoreModalData) return;
    setIsRestoring(true);

    try {
      const data = restoreModalData.file;

      await db.transaction(
        'rw',
        [
          db.transactions,
          db.recurring_bills,
          db.ious,
          db.merchant_rules,
          db.quick_presets,
          db.savings_goals,
          db.categories,
          db.app_settings,
        ],
        async () => {
          if (restoreMode === 'replace') {
            await db.transactions.clear();
            await db.recurring_bills.clear();
            await db.ious.clear();
            await db.merchant_rules.clear();
            await db.quick_presets.clear();
            await db.savings_goals.clear();
          }

          if (data.transactions && Array.isArray(data.transactions)) {
            await db.transactions.bulkPut(data.transactions);
          }
          if (data.recurringBills && Array.isArray(data.recurringBills)) {
            await db.recurring_bills.bulkPut(data.recurringBills);
          }
          if (data.ious && Array.isArray(data.ious)) {
            await db.ious.bulkPut(data.ious);
          }
          if (data.merchantRules && Array.isArray(data.merchantRules)) {
            await db.merchant_rules.bulkPut(data.merchantRules);
          }
          if (data.quickPresets && Array.isArray(data.quickPresets)) {
            await db.quick_presets.bulkPut(data.quickPresets);
          }
          if (data.savingsGoals && Array.isArray(data.savingsGoals)) {
            await db.savings_goals.bulkPut(data.savingsGoals);
          }
          if (data.appSettings) {
            await db.app_settings.put(data.appSettings);
          }
        }
      );

      // Sync updated state to cloud
      pushToCloud().catch(() => {});

      setRestoreModalData(null);
      showToast('Backup restored successfully! All tables refreshed.');
      onRefresh();
    } catch (err) {
      console.error('Restore failed:', err);
      alert('An error occurred during restore. Please inspect your backup file.');
    } finally {
      setIsRestoring(false);
    }
  };

  // 6. Execute Reset Demo Data
  const handleResetDemoData = async () => {
    setIsResetting(true);
    try {
      await clearAllDemoData();
      await pushToCloud().catch(() => {});
      setShowResetConfirmModal(false);
      showToast('All demo data cleared. Ready for live tracking!');
      onRefresh();
    } catch (err) {
      console.error('Failed to reset demo data:', err);
      alert('Failed to reset demo data.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Cloud Sync State */}
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Cloud Persistence & Webhook Sync
              <span className="px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/40 text-[10px] text-cyan-800 dark:text-cyan-300 font-medium">
                Active
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Syncs with server queue & Supabase so incoming SMS webhooks and Parent Links work seamlessly across devices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCloudSync}
          disabled={syncing}
          className="px-4 py-2.5 min-h-[40px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncMessage && (
        <p className="text-xs text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 p-2.5 rounded-xl">
          {syncMessage}
        </p>
      )}

      {/* Export & Restore Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Export JSON */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <FileJson className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Full JSON Backup
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Snapshots all transactions, bills, IOUs, rules, and settings into a single file.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportFullJson}
            className="w-full py-2.5 px-3 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Export .json
          </button>
        </div>

        {/* Export CSV */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Export to CSV
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Clean spreadsheet export of all transactions for Excel, Google Sheets, or CA audit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full py-2.5 px-3 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Export .csv
          </button>
        </div>

        {/* Restore from JSON */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Upload className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Restore Backup
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Restore previously exported JSON snapshot safely with merge or overwrite options.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3 min-h-[38px] rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-amber-200 dark:border-amber-500/20"
          >
            <Upload className="w-3.5 h-3.5" />
            Restore .json
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
        </div>
      </div>

      {/* Reset Demo / Seed Data Card */}
      <div className="p-5 rounded-3xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Reset Demo / Seed Data
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/40 text-[10px] text-rose-700 dark:text-rose-400 font-semibold">
                Clean Slate
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Wipes mock sample transactions, recurring bills, IOUs, and test rules. Strictly preserves your PIN hash, API Key, and Theme settings so you start fresh for real life tracking.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowResetConfirmModal(true)}
          className="px-4 py-2.5 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Demo Data
        </button>
      </div>

      {/* Confirmation Reset Demo Data Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Clear Demo Data?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                This will delete all <strong>sample transactions</strong>, <strong>mock recurring bills</strong>, <strong>sample IOUs</strong>, and <strong>test merchant rules</strong>.
              </p>
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 space-y-1 text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Preserved Intact:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
                  <li>Your 4-Digit Security PIN & Salt</li>
                  <li>Webhook API Key & MacroDroid integration</li>
                  <li>Theme preferences & Custom presets</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemoData}
                disabled={isResetting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors disabled:opacity-50"
              >
                {isResetting ? 'Clearing...' : 'Yes, Clear Demo Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Restore Modal */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Restore Confirmation</h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Ready to restore from <span className="font-mono text-cyan-600 dark:text-cyan-300 font-semibold">{restoreModalData.fileName}</span>:
              </p>

              {/* Summary Stats */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Transactions:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {restoreModalData.file.transactions?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Recurring Bills:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                    {restoreModalData.file.recurringBills?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Pending IOUs:</span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold">
                    {restoreModalData.file.ious?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Auto-Tag Rules:</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    {restoreModalData.file.merchantRules?.length || 0}
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2 pt-2">
                <span className="text-slate-700 dark:text-slate-400 font-semibold text-xs">Restore Mode:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      restoreMode === 'merge'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <Layers className="w-3.5 h-3.5" />
                      Merge Safe
                    </div>
                    <p className="text-[10px] opacity-80">
                      Adds missing records & updates existing IDs without deleting current data.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('replace')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      restoreMode === 'replace'
                        ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Clean Replace
                    </div>
                    <p className="text-[10px] opacity-80">
                      Wipes current tables and replaces completely with backup contents.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
