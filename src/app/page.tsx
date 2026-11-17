'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { BottomNav, TabType } from '@/components/layout/BottomNav';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { CommandPaletteModal } from '@/components/layout/CommandPaletteModal';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { FinancialCharts } from '@/components/dashboard/FinancialCharts';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { DailySafeToSpend } from '@/components/dashboard/DailySafeToSpend';
import { QuickSpendsBar } from '@/components/dashboard/QuickSpendsBar';
import { CategoryBudgetGauges } from '@/components/dashboard/CategoryBudgetGauges';
import { IOULedgerCard } from '@/components/ious/IOULedgerCard';
import { SplitsView } from '@/components/ious/SplitsView';
import { SettleIOUPromptModal } from '@/components/ious/SettleIOUPromptModal';
import { RecurringBillsCard } from '@/components/bills/RecurringBillsCard';
import { VoiceExpenseModal } from '@/components/voice/VoiceExpenseModal';
import { PinLockScreen } from '@/components/auth/PinLockScreen';
import { PinSettingsModal } from '@/components/auth/PinSettingsModal';
import { QuickCategorizeSheet } from '@/components/transactions/QuickCategorizeSheet';
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal';
import { ScanAndPayModal } from '@/components/transactions/ScanAndPayModal';
import { QuickLogSheet } from '@/components/transactions/QuickLogSheet';
import { ReconcileBalanceModal } from '@/components/dashboard/ReconcileBalanceModal';
import { QuickSmsPasteModal } from '@/components/transactions/QuickSmsPasteModal';
import { GPayImporterModal } from '@/components/importer/GPayImporterModal';
import { SavingsGoalsView } from '@/components/savings/SavingsGoalsView';
import { SettingsView } from '@/components/settings/SettingsView';
import {
  db,
  initializeDatabase,
  findMatchingPendingIOU,
} from '@/lib/db';
import {
  Transaction,
  Category,
  MerchantRule,
  SavingsGoal,
  AppSettings,
  IOU,
  QuickSpendPreset,
  RecurringBill,
} from '@/lib/types';
import { registerServiceWorker } from '@/lib/pwa';
import { pullUnsyncedFromCloud, pushToCloud } from '@/lib/sync';
import {
  isSessionUnlocked,
  recordUserActivity,
  clearUnlockSession,
} from '@/lib/sessionAuth';
import { setActiveCurrency } from '@/lib/formatters';
import { Sparkles, MessageSquareText, ShieldAlert, QrCode } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();

  // App State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Database Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [ious, setIous] = useState<IOU[]>([]);
  const [presets, setPresets] = useState<QuickSpendPreset[]>([]);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanAndPayModal, setShowScanAndPayModal] = useState(false);
  const [showQuickLogSheet, setShowQuickLogSheet] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPinSettingsModal, setShowPinSettingsModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [activePromptTxn, setActivePromptTxn] = useState<Transaction | null>(null);

  // Settlement Hook Modal
  const [settleMatch, setSettleMatch] = useState<{ iou: IOU; txn: Transaction } | null>(null);

  // Load all DB state
  const loadData = useCallback(async () => {
    try {
      await initializeDatabase();
      const currentSettings = await db.app_settings.get('global');
      setSettings(currentSettings || null);

      if (currentSettings?.currency) {
        setActiveCurrency(currentSettings.currency);
      }

      // Verify Google Pay-style persistent unlock session
      if (currentSettings?.pinEnabled && currentSettings?.pinHash) {
        const isUnlocked = await isSessionUnlocked(
          true,
          currentSettings.autoLockMinutes ?? 5
        );
        setIsLocked(!isUnlocked);
      } else {
        setIsLocked(false);
      }

      const txns = await db.transactions.orderBy('timestamp').reverse().toArray();
      setTransactions(txns);

      const cats = await db.categories.toArray();
      setCategories(cats);

      const rules = await db.merchant_rules.toArray();
      setMerchantRules(rules);

      const goals = await db.savings_goals.toArray();
      setSavingsGoals(goals);

      const allIous = await db.ious.orderBy('createdAt').reverse().toArray();
      setIous(allIous);

      const allPresets = await db.quick_presets.toArray();
      setPresets(allPresets);

      const allBills = await db.recurring_bills.toArray();
      setBills(allBills);

      // Check for pending uncategorized transaction
      const uncategorized = txns.find((t) => !t.isCategorized);
      if (uncategorized && !activePromptTxn) {
        setActivePromptTxn(uncategorized);
      }

      // Sync snapshot to cloud in the background for remote parent views
      pushToCloud().catch(() => {});
    } catch (err) {
      console.error('Failed to load Money Flow DB:', err);
    } finally {
      setLoading(false);
    }
  }, [activePromptTxn]);

  useEffect(() => {
    registerServiceWorker();
    loadData();
  }, [loadData]);

  // Cloud Sync Listener: Checks for incoming SMS webhooks and syncs state
  useEffect(() => {
    async function checkForWebhookTransactions() {
      try {
        const newTxns = await pullUnsyncedFromCloud();
        if (newTxns.length > 0) {
          await loadData();
          const uncategorized = newTxns.find((t) => !t.isCategorized);
          if (uncategorized) {
            setActivePromptTxn(uncategorized);
          }
        }
      } catch (e) {
        // silent fail when offline
      }
    }

    checkForWebhookTransactions();
    window.addEventListener('focus', checkForWebhookTransactions);
    const interval = setInterval(checkForWebhookTransactions, 30000);

    return () => {
      window.removeEventListener('focus', checkForWebhookTransactions);
      clearInterval(interval);
    };
  }, [loadData]);

  // Handle URL search parameters (e.g. from PWA shortcuts or share target)
  useEffect(() => {
    const action = searchParams.get('action');
    const promptId = searchParams.get('prompt_txn') || searchParams.get('categorize');
    const tabParam = searchParams.get('tab');

    if (tabParam === 'splits') {
      setActiveTab('splits');
    }

    if (action === 'add') {
      setShowAddModal(true);
    } else if (action === 'quick-log') {
      setShowQuickLogSheet(true);
    } else if (action === 'scan-pay') {
      setShowScanAndPayModal(true);
    } else if (action === 'voice') {
      setShowVoiceModal(true);
    } else if (action === 'reconcile') {
      setShowReconcileModal(true);
    } else if (action === 'import') {
      setShowImportModal(true);
    }

    if (promptId && transactions.length > 0) {
      const target = transactions.find((t) => t.id === promptId);
      if (target) {
        setActivePromptTxn(target);
      }
    }
  }, [searchParams, transactions]);

  // Global Cmd/Ctrl+K Quick Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Google Pay-Style Inactivity & Background Auto-Lock Tracker
  useEffect(() => {
    const handleActivity = () => {
      recordUserActivity();
      setLastActivity(Date.now());
    };

    window.addEventListener('pointerdown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });

    // When returning to the app after backgrounding or switching tabs
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        if (settings?.pinEnabled && settings?.pinHash) {
          const unlocked = await isSessionUnlocked(
            true,
            settings.autoLockMinutes ?? 5
          );
          if (!unlocked) {
            setIsLocked(true);
          } else {
            recordUserActivity();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check every 10 seconds for idle timeout expiration
    const interval = setInterval(async () => {
      if (settings?.pinEnabled && settings?.pinHash && !isLocked) {
        const unlocked = await isSessionUnlocked(
          true,
          settings.autoLockMinutes ?? 5
        );
        if (!unlocked) {
          setIsLocked(true);
        }
      }
    }, 10000);

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [settings, isLocked]);

  // Check incoming transaction for IOU match
  const checkAutoSettlement = async (txn: Transaction) => {
    if (txn.type === 'income') {
      const match = await findMatchingPendingIOU(txn.merchant, txn.amount);
      if (match) {
        setSettleMatch({ iou: match, txn });
      }
    }
  };

  // Calculations for Summary & Safe-to-Spend
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTxns = transactions.filter((t) => {
    const d = new Date(t.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalIncome = currentMonthTxns
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = currentMonthTxns
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavings = currentMonthTxns
    .filter((t) => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = totalIncome - totalExpense - totalSavings;
  const uncategorizedCount = transactions.filter((t) => !t.isCategorized).length;

  // Auto-calculated recurring fixed commitments from active bills
  const activeBillsTotal = bills
    .filter((b) => b.isActive)
    .reduce((sum, b) => sum + (b.billingCycle === 'monthly' ? b.amount : Math.round(b.amount / 12)), 0);

  const fixedRecurringToUse = activeBillsTotal > 0 ? activeBillsTotal : settings?.fixedRecurringBills || 8000;

  // Calculate Spent Today (IST)
  const isToday = (ts: number) => {
    const d = new Date(ts);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const spentToday = transactions
    .filter((t) => t.type === 'expense' && isToday(t.timestamp))
    .reduce((sum, t) => sum + t.amount, 0);

  // Safe-to-Spend daily baseline calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);
  const netDiscretionary = Math.max(
    0,
    (settings?.monthlyBudget || 25000) - fixedRecurringToUse - totalExpense
  );
  const dailySafeLimit = Math.max(0, Math.round(netDiscretionary / daysRemaining));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 transition-colors">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-500 dark:text-slate-400">Loading Money Flow Vault...</p>
      </div>
    );
  }

  // If locked, present clean PIN screen
  if (isLocked) {
    return (
      <PinLockScreen
        storedHash={settings?.pinHash || null}
        onUnlock={() => {
          setIsLocked(false);
          recordUserActivity();
          setLastActivity(Date.now());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors w-full max-w-full overflow-x-clip min-w-0">
      {/* Fixed Non-Scrolling Desktop Sidebar (Pinned on lg: >=1024px) */}
      <DesktopSidebar
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        onOpenAddModal={() => setShowAddModal(true)}
        onOpenScanAndPayModal={() => setShowScanAndPayModal(true)}
        onOpenQuickLogSheet={() => setShowQuickLogSheet(true)}
        onOpenReconcileModal={() => setShowReconcileModal(true)}
        onOpenVoiceModal={() => setShowVoiceModal(true)}
        onOpenImportModal={() => setShowImportModal(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onLockApp={() => {
          clearUnlockSession();
          setIsLocked(true);
        }}
        uncategorizedCount={uncategorizedCount}
        pendingIousCount={ious.filter((i) => i.status === 'pending').length}
      />

      {/* Main App Workspace (Offset by lg:pl-64 for pinned sidebar) */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-clip lg:pl-64">
        {/* Top Header */}
        <Header
          onLockApp={() => {
            clearUnlockSession();
            setIsLocked(true);
          }}
          isPinEnabled={Boolean(settings?.pinEnabled && settings?.pinHash)}
          onOpenPinSettings={() => setShowPinSettingsModal(true)}
          onOpenParentShare={() => setActiveTab('settings')}
          onOpenVoiceModal={() => setShowVoiceModal(true)}
          onOpenScanAndPay={() => setShowScanAndPayModal(true)}
          uncategorizedCount={uncategorizedCount}
          activeTab={activeTab}
          onChangeTab={(t) => setActiveTab(t)}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8 space-y-4 sm:space-y-6 overflow-x-clip min-w-0">
        {/* Uncategorized Prompt Notification Banner */}
        {uncategorizedCount > 0 && (
          <div className="p-3 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3 text-xs animate-fade-in shadow-xs min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-amber-800 dark:text-amber-300 truncate">
                  {uncategorizedCount} Pending Transaction{uncategorizedCount > 1 ? 's' : ''} Need Categorization
                </p>
                <p className="text-slate-600 dark:text-slate-400 truncate">
                  Tap to 1-click categorize where your money was spent.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const target = transactions.find((t) => !t.isCategorized);
                if (target) setActivePromptTxn(target);
              }}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-xs"
            >
              Categorize
            </button>
          </div>
        )}

        {/* Tab 1: Dashboard (12-Column Responsive Bento Grid on >=1024px) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 sm:space-y-6 min-w-0 w-full">
            {/* Top Row: Daily Safe-to-Spend (5 cols) + Summary Cards (7 cols, 2x2 grid inside) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 lg:gap-6 items-stretch min-w-0 w-full">
              <div className="lg:col-span-5 h-full min-w-0">
                <DailySafeToSpend
                  monthlyBudget={settings?.monthlyBudget || 25000}
                  fixedRecurringBills={fixedRecurringToUse}
                  totalSpentThisMonth={totalExpense}
                  spentToday={spentToday}
                  onBudgetUpdated={loadData}
                />
              </div>
              <div className="lg:col-span-7 h-full flex flex-col justify-between min-w-0">
                <SummaryCards
                  currentBalance={currentBalance}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                  totalSavings={totalSavings}
                  onOpenReconcile={() => setShowReconcileModal(true)}
                />
              </div>
            </div>

            {/* Second Row: 1-Tap Frequent Spends Speed Dial (Full 12 Columns) */}
            <div className="w-full min-w-0 overflow-hidden">
              <QuickSpendsBar presets={presets} onLogged={loadData} />
            </div>

            {/* Zero-Balance / First-Time Onboarding Prompt */}
            {transactions.length === 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in shadow-xs min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Welcome to Money Flow Vault</p>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      Your vault is ready. Tap <strong>+ Add</strong>, scan any merchant UPI QR, or paste a bank SMS to log your first spend.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScanAndPayModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan & Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all"
                  >
                    + Add Transaction
                  </button>
                </div>
              </div>
            )}

            {/* Main Body Bento: Left 7 Columns (Charts & Activity) + Right 5 Columns (Budgets, IOUs, Bills) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 lg:gap-6 items-start min-w-0 w-full">
              {/* Left Column (7 cols): Financial Charts + Recent Transactions Feed */}
              <div className="lg:col-span-7 space-y-4 sm:space-y-6 min-w-0">
                <FinancialCharts transactions={transactions} />
                <RecentTransactions
                  transactions={transactions.slice(0, 8)}
                  categories={categories}
                  onOpenCategorizeModal={(txn) => setActivePromptTxn(txn)}
                  onRefresh={loadData}
                />
              </div>

              {/* Right Column (5 cols): Category Budget Gauges + Split & IOUs + Recurring Bills */}
              <div className="lg:col-span-5 space-y-4 sm:space-y-6 min-w-0">
                <CategoryBudgetGauges categories={categories} transactions={transactions} />
                <IOULedgerCard
                  ious={ious}
                  onRefresh={loadData}
                  onOpenSplitsHub={() => setActiveTab('splits')}
                  defaultUpiId={settings?.upiId}
                  onSaveUpiId={async (upi) => {
                    await db.app_settings.update('global', { upiId: upi });
                    loadData();
                  }}
                />
                <RecurringBillsCard bills={bills} onRefresh={loadData} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Activity (Full Transactions, IOUs & Recurring Bills) */}
        {activeTab === 'transactions' && (
          <div className="space-y-4 sm:space-y-6 min-w-0 w-full">
            <RecurringBillsCard bills={bills} onRefresh={loadData} />
            <IOULedgerCard
              ious={ious}
              onRefresh={loadData}
              onOpenSplitsHub={() => setActiveTab('splits')}
              defaultUpiId={settings?.upiId}
              onSaveUpiId={async (upi) => {
                await db.app_settings.update('global', { upiId: upi });
                loadData();
              }}
            />
            <RecentTransactions
              transactions={transactions}
              categories={categories}
              onOpenCategorizeModal={(txn) => setActivePromptTxn(txn)}
              onRefresh={loadData}
            />
          </div>
        )}

        {/* Tab 3: Splits & IOU Recovery Hub */}
        {activeTab === 'splits' && (
          <div className="min-w-0 w-full">
            <SplitsView
              ious={ious}
              onRefresh={loadData}
              defaultUpiId={settings?.upiId}
              onSaveUpiId={async (upi) => {
                await db.app_settings.update('global', { upiId: upi });
                loadData();
              }}
            />
          </div>
        )}

        {/* Tab 4: Analytics & Trends */}
        {activeTab === 'analytics' && (
          <div className="min-w-0 w-full">
            <AnalyticsView
              transactions={transactions}
              categories={categories}
              bills={bills}
              ious={ious}
              monthlyBudget={settings?.monthlyBudget}
            />
          </div>
        )}

        {/* Tab 4: Savings Goals */}
        {activeTab === 'savings' && (
          <div className="min-w-0 w-full">
            <SavingsGoalsView goals={savingsGoals} onRefresh={loadData} />
          </div>
        )}

        {/* Tab 5: Settings & Parent Links */}
        {activeTab === 'settings' && (
          <div className="min-w-0 w-full">
            <SettingsView
              settings={settings}
              categories={categories}
              merchantRules={merchantRules}
              onOpenPinSettings={() => setShowPinSettingsModal(true)}
              onRefresh={loadData}
              onOpenReconcile={() => setShowReconcileModal(true)}
              onSimulateWebhook={(txn) => {
                loadData();
                checkAutoSettlement(txn);
                setActivePromptTxn(txn);
              }}
            />
          </div>
        )}
      </main>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        onOpenAddModal={() => setShowAddModal(true)}
        onOpenScanAndPayModal={() => setShowScanAndPayModal(true)}
        onOpenQuickLogSheet={() => setShowQuickLogSheet(true)}
        onOpenImportModal={() => setShowImportModal(true)}
        onOpenQuickPasteModal={() => setShowQuickPasteModal(true)}
        onOpenVoiceModal={() => setShowVoiceModal(true)}
        uncategorizedCount={uncategorizedCount}
      />

      {/* Modal: Hands-Free Voice-to-Expense NLP */}
      {showVoiceModal && (
        <VoiceExpenseModal
          onClose={() => setShowVoiceModal(false)}
          onAdded={(txn) => {
            loadData();
            checkAutoSettlement(txn);
            setActivePromptTxn(txn);
          }}
        />
      )}

      {/* Modal: Instant Categorization Prompt (Bottom-Sheet with Split option) */}
      {activePromptTxn && (
        <QuickCategorizeSheet
          transaction={activePromptTxn}
          categories={categories}
          onClose={() => setActivePromptTxn(null)}
          onCategorized={() => {
            loadData();
          }}
        />
      )}

      {/* Modal: Add Transaction (with Split toggle) */}
      {showAddModal && (
        <AddTransactionModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onAdded={loadData}
        />
      )}

      {/* Modal: Quick SMS / Notification Paste */}
      {showQuickPasteModal && (
        <QuickSmsPasteModal
          onClose={() => setShowQuickPasteModal(false)}
          onIngested={(txn) => {
            loadData();
            checkAutoSettlement(txn);
            setActivePromptTxn(txn);
          }}
        />
      )}

      {/* Modal: GPay CSV & PDF Importer */}
      {showImportModal && (
        <GPayImporterModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={loadData}
        />
      )}

      {/* Modal: PIN Settings */}
      {showPinSettingsModal && (
        <PinSettingsModal
          settings={settings}
          onClose={() => setShowPinSettingsModal(false)}
          onUpdated={loadData}
        />
      )}

      {/* Modal: Auto-Settlement IOU Prompt */}
      {settleMatch && (
        <SettleIOUPromptModal
          matchingIOU={settleMatch.iou}
          incomingTxn={settleMatch.txn}
          onClose={() => setSettleMatch(null)}
          onSettled={loadData}
        />
      )}

      {/* Modal: Scan & Pay UPI QR Launcher */}
      {showScanAndPayModal && (
        <ScanAndPayModal
          categories={categories}
          dailySafeLimit={dailySafeLimit}
          spentToday={spentToday}
          onClose={() => setShowScanAndPayModal(false)}
          onLogged={loadData}
        />
      )}

      {/* Modal: 1-Second Quick Numpad for Micro-Spends */}
      {showQuickLogSheet && (
        <QuickLogSheet
          categories={categories}
          onClose={() => setShowQuickLogSheet(false)}
          onLogged={loadData}
        />
      )}

      {/* Modal: Reconcile Bank / UPI Lite Balance */}
      {showReconcileModal && (
        <ReconcileBalanceModal
          calculatedBalance={currentBalance}
          categories={categories}
          onClose={() => setShowReconcileModal(false)}
          onReconciled={loadData}
        />
      )}

      {/* Modal: Global Cmd/Ctrl+K Command Palette */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onOpenAdd={() => setShowAddModal(true)}
        onOpenScanAndPay={() => setShowScanAndPayModal(true)}
        onOpenQuickLog={() => setShowQuickLogSheet(true)}
        onOpenReconcile={() => setShowReconcileModal(true)}
        onOpenVoice={() => setShowVoiceModal(true)}
        onOpenImport={() => setShowImportModal(true)}
        onOpenQuickPaste={() => setShowQuickPasteModal(true)}
        onLockApp={() => {
          clearUnlockSession();
          setIsLocked(true);
        }}
        transactions={transactions}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading Money Flow...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
