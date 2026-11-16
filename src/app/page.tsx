'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { BottomNav, TabType } from '@/components/layout/BottomNav';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { FinancialCharts } from '@/components/dashboard/FinancialCharts';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { DailySafeToSpend } from '@/components/dashboard/DailySafeToSpend';
import { QuickSpendsBar } from '@/components/dashboard/QuickSpendsBar';
import { CategoryBudgetGauges } from '@/components/dashboard/CategoryBudgetGauges';
import { IOULedgerCard } from '@/components/ious/IOULedgerCard';
import { SettleIOUPromptModal } from '@/components/ious/SettleIOUPromptModal';
import { RecurringBillsCard } from '@/components/bills/RecurringBillsCard';
import { VoiceExpenseModal } from '@/components/voice/VoiceExpenseModal';
import { PinLockScreen } from '@/components/auth/PinLockScreen';
import { PinSettingsModal } from '@/components/auth/PinSettingsModal';
import { QuickCategorizeSheet } from '@/components/transactions/QuickCategorizeSheet';
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal';
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
import { Sparkles, MessageSquareText, ShieldAlert } from 'lucide-react';

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
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPinSettingsModal, setShowPinSettingsModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [activePromptTxn, setActivePromptTxn] = useState<Transaction | null>(null);

  // Settlement Hook Modal
  const [settleMatch, setSettleMatch] = useState<{ iou: IOU; txn: Transaction } | null>(null);

  // Load all DB state
  const loadData = useCallback(async () => {
    try {
      await initializeDatabase();
      const currentSettings = await db.app_settings.get('global');
      setSettings(currentSettings || null);

      // Check if locked
      if (currentSettings?.pinEnabled && currentSettings?.pinHash) {
        setIsLocked(true);
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

    if (action === 'add') {
      setShowAddModal(true);
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

  // Inactivity Auto-Lock Tracker
  useEffect(() => {
    const recordActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('touchstart', recordActivity);
    window.addEventListener('scroll', recordActivity);

    const autoLockMinutes = settings?.autoLockMinutes || 5;
    const interval = setInterval(() => {
      if (settings?.pinEnabled && settings?.pinHash && !isLocked) {
        const elapsedMinutes = (Date.now() - lastActivity) / 60000;
        if (elapsedMinutes >= autoLockMinutes) {
          setIsLocked(true);
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      clearInterval(interval);
    };
  }, [settings, isLocked, lastActivity]);

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
          setLastActivity(Date.now());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Header */}
      <Header
        onLockApp={() => setIsLocked(true)}
        isPinEnabled={Boolean(settings?.pinEnabled && settings?.pinHash)}
        onOpenPinSettings={() => setShowPinSettingsModal(true)}
        onOpenParentShare={() => setActiveTab('settings')}
        onOpenVoiceModal={() => setShowVoiceModal(true)}
        uncategorizedCount={uncategorizedCount}
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-12 space-y-6">
        {/* Uncategorized Prompt Notification Banner */}
        {uncategorizedCount > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between text-xs animate-fade-in shadow-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin-slow" />
              <div>
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  {uncategorizedCount} Pending Transaction{uncategorizedCount > 1 ? 's' : ''} Need Categorization
                </p>
                <p className="text-slate-600 dark:text-slate-400">
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
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-xs"
            >
              Categorize
            </button>
          </div>
        )}

        {/* Tab 1: Dashboard (12-Column Responsive Bento Grid on >=1024px) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Row: Daily Safe-to-Spend (5 cols) + Summary Cards (7 cols, 2x2 grid inside) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
              <div className="lg:col-span-5 h-full">
                <DailySafeToSpend
                  monthlyBudget={settings?.monthlyBudget || 25000}
                  fixedRecurringBills={fixedRecurringToUse}
                  totalSpentThisMonth={totalExpense}
                  spentToday={spentToday}
                  onBudgetUpdated={loadData}
                />
              </div>
              <div className="lg:col-span-7 h-full flex flex-col justify-between">
                <SummaryCards
                  currentBalance={currentBalance}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                  totalSavings={totalSavings}
                />
              </div>
            </div>

            {/* Second Row: 1-Tap Frequent Spends Speed Dial (Full 12 Columns) */}
            <div className="w-full">
              <QuickSpendsBar presets={presets} onLogged={loadData} />
            </div>

            {/* Main Body Bento: Left 7 Columns (Charts & Activity) + Right 5 Columns (Budgets, IOUs, Bills) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
              {/* Left Column (7 cols): Financial Charts + Recent Transactions Feed */}
              <div className="lg:col-span-7 space-y-6">
                <FinancialCharts transactions={transactions} />
                <RecentTransactions
                  transactions={transactions.slice(0, 8)}
                  categories={categories}
                  onOpenCategorizeModal={(txn) => setActivePromptTxn(txn)}
                  onRefresh={loadData}
                />
              </div>

              {/* Right Column (5 cols): Category Budget Gauges + Split & IOUs + Recurring Bills */}
              <div className="lg:col-span-5 space-y-6">
                <CategoryBudgetGauges categories={categories} transactions={transactions} />
                <IOULedgerCard ious={ious} onRefresh={loadData} />
                <RecurringBillsCard bills={bills} onRefresh={loadData} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Activity (Full Transactions, IOUs & Recurring Bills) */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <RecurringBillsCard bills={bills} onRefresh={loadData} />
            <IOULedgerCard ious={ious} onRefresh={loadData} />
            <RecentTransactions
              transactions={transactions}
              categories={categories}
              onOpenCategorizeModal={(txn) => setActivePromptTxn(txn)}
              onRefresh={loadData}
            />
          </div>
        )}

        {/* Tab 3: Savings Goals */}
        {activeTab === 'savings' && (
          <SavingsGoalsView goals={savingsGoals} onRefresh={loadData} />
        )}

        {/* Tab 4: Settings & Parent Links */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            categories={categories}
            merchantRules={merchantRules}
            onOpenPinSettings={() => setShowPinSettingsModal(true)}
            onRefresh={loadData}
            onSimulateWebhook={(txn) => {
              loadData();
              checkAutoSettlement(txn);
              setActivePromptTxn(txn);
            }}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(t) => setActiveTab(t)}
        onOpenAddModal={() => setShowAddModal(true)}
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
