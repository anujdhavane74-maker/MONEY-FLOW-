'use client';

import React, { useState, memo } from 'react';
import confetti from 'canvas-confetti';
import {
  PiggyBank,
  Plus,
  Sparkles,
  Calendar,
  X,
  Laptop,
  ShieldCheck,
  Palmtree,
  Car,
  Home,
  GraduationCap,
  Target,
  TrendingUp,
} from 'lucide-react';
import { SavingsGoal } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { db } from '@/lib/db';

interface SavingsGoalsViewProps {
  goals: SavingsGoal[];
  onRefresh: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Laptop: <Laptop className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />,
  Palmtree: <Palmtree className="w-5 h-5" />,
  Car: <Car className="w-5 h-5" />,
  Home: <Home className="w-5 h-5" />,
  GraduationCap: <GraduationCap className="w-5 h-5" />,
  PiggyBank: <PiggyBank className="w-5 h-5" />,
};

const QUICK_CHIPS = [500, 1000, 2000, 5000];

export const SavingsGoalsView = memo(function SavingsGoalsView({ goals, onRefresh }: SavingsGoalsViewProps) {
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [showNewGoalModal, setShowNewGoalModal] = useState<boolean>(false);

  // New goal form state
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');
  const [newDeadline, setNewDeadline] = useState('');
  const [newIcon, setNewIcon] = useState('PiggyBank');

  const totalSavedAcrossGoals = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForDeposit) return;
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    const updatedAmount = selectedGoalForDeposit.currentAmount + amt;

    // 1. Update Goal
    await db.savings_goals.update(selectedGoalForDeposit.id, {
      currentAmount: updatedAmount,
    });

    // 2. Log a Savings transaction
    await db.transactions.add({
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: amt,
      type: 'savings',
      category: 'Savings & Investments',
      merchant: `Goal: ${selectedGoalForDeposit.title}`,
      timestamp: Date.now(),
      source: 'manual',
      notes: `Contribution to ${selectedGoalForDeposit.title}`,
      isCategorized: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Confetti celebration
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (e) {
      // ignore
    }

    setDepositAmount('');
    setSelectedGoalForDeposit(null);
    onRefresh();
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmt = parseFloat(newTarget);
    const currAmt = parseFloat(newCurrent) || 0;
    if (isNaN(targetAmt) || targetAmt <= 0) return;

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newTitle.trim(),
      targetAmount: targetAmt,
      currentAmount: currAmt,
      deadline: newDeadline || undefined,
      icon: newIcon,
      createdAt: Date.now(),
    };

    await db.savings_goals.add(newGoal);

    if (currAmt > 0) {
      await db.transactions.add({
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        amount: currAmt,
        type: 'savings',
        category: 'Savings & Investments',
        merchant: `Initial: ${newGoal.title}`,
        timestamp: Date.now(),
        source: 'manual',
        isCategorized: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    setNewTitle('');
    setNewTarget('');
    setNewCurrent('0');
    setNewDeadline('');
    setShowNewGoalModal(false);
    onRefresh();
  };

  // Pacing Calculation
  const getPacingInfo = (goal: SavingsGoal) => {
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    if (remaining === 0) return { status: 'completed', text: 'Goal Achieved! 🎉' };
    if (!goal.deadline) return { status: 'no_deadline', text: `${formatINR(remaining)} remaining` };

    const targetTime = new Date(goal.deadline).getTime();
    const diffMs = targetTime - Date.now();
    const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));

    if (diffMs <= 0) {
      return { status: 'overdue', text: `Target date passed • ${formatINR(remaining)} remaining` };
    }

    const perDay = Math.ceil(remaining / daysLeft);
    const perMonth = Math.ceil(remaining / monthsLeft);

    return {
      status: 'active',
      daysLeft,
      perDay,
      perMonth,
      text: `Pace: ${formatINR(perDay)}/day (${formatINR(perMonth)}/mo) to finish on time`,
    };
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 w-full">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 lg:p-6 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              Savings Vault & Goals
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums shrink-0">
              {goals.length} Goals
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            Target-date auto-pacing, dedicated reserve pools, and 1-tap contributions
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 min-w-0 shrink-0">
          <div className="text-left sm:text-right shrink-0">
            <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
              Total Saved
            </span>
            <p className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatINR(totalSavedAcrossGoals)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewGoalModal(true)}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Goal</span>
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
        {goals.map((goal) => {
          const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
          const pacing = getPacingInfo(goal);

          return (
            <div
              key={goal.id}
              className="p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-900/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgb(15,23,42,0.05)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] space-y-3.5 hover:border-slate-300 dark:hover:border-slate-700/80 transition-all min-w-0 overflow-hidden flex flex-col justify-between"
            >
              {/* Header: Icon + Title + Visual Progress Ring */}
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                    {ICON_MAP[goal.icon || 'PiggyBank'] || <PiggyBank className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {goal.title}
                    </h3>
                    {goal.deadline ? (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                        <Calendar className="w-3 h-3 shrink-0" /> Target: {goal.deadline}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block truncate">
                        Open-ended target
                      </span>
                    )}
                  </div>
                </div>

                {/* SVG Visual Progress Ring */}
                <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                  <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 transition-all duration-700"
                      strokeDasharray={`${percent}, 100`}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-slate-900 dark:text-slate-100">
                    {percent}%
                  </div>
                </div>
              </div>

              {/* Progress Bar & Amount Figures */}
              <div className="space-y-1.5 min-w-0">
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs font-mono tabular-nums gap-1 min-w-0">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                    {formatINR(goal.currentAmount)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 truncate text-right">
                    Target {formatINR(goal.targetAmount)}
                  </span>
                </div>
              </div>

              {/* Target-Date Auto-Pacing Banner */}
              <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 min-w-0">
                <Target className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="truncate">{pacing.text}</span>
              </div>

              {/* Bottom: Remaining info + Contribute Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                  {remaining > 0 ? `${formatINR(remaining)} to go` : 'Goal achieved! 🎉'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGoalForDeposit(goal);
                    setDepositAmount('1000');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Contribute</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deposit / Contribute Modal (Bottom sheet on mobile) */}
      {selectedGoalForDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedGoalForDeposit(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Contribute to Goal</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGoalForDeposit(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adding funds to <strong>{selectedGoalForDeposit.title}</strong>
            </p>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setDepositAmount(chip.toString())}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                >
                  +{formatINR(chip)}
                </button>
              ))}
            </div>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Amount (INR ₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  autoFocus
                  placeholder="e.g. 2000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Confirm Contribution</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Goal Modal (Bottom sheet on mobile) */}
      {showNewGoalModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowNewGoalModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Savings Goal</h3>
              <button
                type="button"
                onClick={() => setShowNewGoalModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip, New Bike, Emergency Fund"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Target Amount (INR ₹)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 50000"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Initial Saved Amount
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newCurrent}
                  onChange={(e) => setNewCurrent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Target Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-xs"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
