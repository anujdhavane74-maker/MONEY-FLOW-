'use client';

import React, { useState, useRef } from 'react';
import {
  Database,
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
} from 'lucide-react';
import Papa from 'papaparse';
import { db } from '@/lib/db';
import { formatISTDate, formatISTTime } from '@/lib/formatters';
import { performFullSync } from '@/lib/sync';
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
    // Reset input
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

          // Restore transactions
          if (data.transactions && Array.isArray(data.transactions)) {
            await db.transactions.bulkPut(data.transactions);
          }

          // Restore recurring bills
          if (data.recurringBills && Array.isArray(data.recurringBills)) {
            await db.recurring_bills.bulkPut(data.recurringBills);
          }

          // Restore IOUs
          if (data.ious && Array.isArray(data.ious)) {
            await db.ious.bulkPut(data.ious);
          }

          // Restore rules
          if (data.merchantRules && Array.isArray(data.merchantRules)) {
            await db.merchant_rules.bulkPut(data.merchantRules);
          }

          // Restore presets
          if (data.quickPresets && Array.isArray(data.quickPresets)) {
            await db.quick_presets.bulkPut(data.quickPresets);
          }

          // Restore goals
          if (data.savingsGoals && Array.isArray(data.savingsGoals)) {
            await db.savings_goals.bulkPut(data.savingsGoals);
          }

          // Restore settings (preserve PIN if not in backup)
          if (data.appSettings) {
            await db.app_settings.put(data.appSettings);
          }
        }
      );

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

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Cloud Sync State */}
      <div className="p-5 rounded-3xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Cloud Persistence & Webhook Sync
              <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-300 font-medium">
                Active
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Syncs with server queue & Supabase so incoming SMS webhooks and Parent Links work seamlessly across devices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCloudSync}
          disabled={syncing}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-cyan-500/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncMessage && (
        <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 p-2.5 rounded-xl">
          {syncMessage}
        </p>
      )}

      {/* Export & Restore Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Export JSON */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <FileJson className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Full JSON Backup
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Snapshots all transactions, bills, IOUs, rules, and settings into a single file.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportFullJson}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Export .json
          </button>
        </div>

        {/* Export CSV */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Export to CSV
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Clean spreadsheet export of all transactions for Excel, Google Sheets, or CA audit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            Export .csv
          </button>
        </div>

        {/* Restore from JSON */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-amber-400">
              <Upload className="w-5 h-5" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Restore Backup
              </h4>
            </div>
            <p className="text-[11px] text-slate-400">
              Restore previously exported JSON snapshot safely with merge or overwrite options.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-amber-500/20"
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

      {/* Confirmation Restore Modal */}
      {restoreModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Restore Confirmation</h3>
              </div>
              <button
                type="button"
                onClick={() => setRestoreModalData(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Ready to restore from <span className="font-mono text-cyan-300">{restoreModalData.fileName}</span>:
              </p>

              {/* Summary Stats */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Transactions:</span>
                  <span className="text-emerald-400 font-bold">
                    {restoreModalData.file.transactions?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recurring Bills:</span>
                  <span className="text-cyan-400 font-bold">
                    {restoreModalData.file.recurringBills?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pending IOUs:</span>
                  <span className="text-purple-400 font-bold">
                    {restoreModalData.file.ious?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Auto-Tag Rules:</span>
                  <span className="text-amber-400 font-bold">
                    {restoreModalData.file.merchantRules?.length || 0}
                  </span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2 pt-2">
                <span className="text-slate-400 font-semibold text-xs">Restore Mode:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      restoreMode === 'merge'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800'
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
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
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
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
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
