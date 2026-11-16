'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  PiggyBank,
  Plus,
  Target,
  Sparkles,
  CheckCircle2,
  Calendar,
  X,
  TrendingUp,
  Laptop,
  ShieldCheck,
  Palmtree,
  Car,
  Home,
  GraduationCap,
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

export function SavingsGoalsView({ goals, onRefresh }: SavingsGoalsViewProps) {
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [showNewGoalModal, setShowNewGoalModal] = useState<boolean>(false);

  // New goal state
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');
  const [newDeadline, setNewDeadline] = useState('');
  const [newIcon, setNewIcon] = useState('PiggyBank');

  const totalSavedAcrossGoals = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTargetAcrossGoals = goals.reduce((sum, g) => sum + g.targetAmount, 0);

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

    // 2. Also log a Savings transaction
    await db.transactions.add({
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: amt,
      type: 'savings',
      category: 'Savings & Investments',
      merchant: `Goal: ${selectedGoalForDeposit.title}`,
      timestamp: Date.now(),
      source: 'manual',
      notes: `Deposit to ${selectedGoalForDeposit.title}`,
      isCategorized: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Confetti celebration!
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#10b981', '#06b6d4', '#f59e0b'],
      });
    } catch {
      // ignore
    }

    setDepositAmount('');
    setSelectedGoalForDeposit(null);
    onRefresh();
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newTarget);
    const current = parseFloat(newCurrent) || 0;
    if (!newTitle.trim() || isNaN(target) || target <= 0) return;

    await db.savings_goals.add({
      id: `goal-${Date.now()}`,
      title: newTitle.trim(),
      targetAmount: target,
      currentAmount: current,
      deadline: newDeadline || undefined,
      icon: newIcon,
      color: '#10b981',
      createdAt: Date.now(),
    });

    setNewTitle('');
    setNewTarget('');
    setNewCurrent('0');
    setNewDeadline('');
    setShowNewGoalModal(false);
    onRefresh();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Total Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Savings & Wealth Vault
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20">
              Zero Expense Impact
            </span>
          </div>
          <h1 className="text-2xl font-black text-white">Savings Goals</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Transfers to savings grow your net worth without hurting your spending budget.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Saved</span>
            <p className="text-xl font-black font-mono text-emerald-400 tabular-nums">
              {formatINR(totalSavedAcrossGoals)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewGoalModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Goal
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

          return (
            <div
              key={goal.id}
              className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800/80 shadow-lg space-y-4 hover:border-slate-700/80 transition-all"
            >
              {/* Top: Icon + Title + % */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                    {ICON_MAP[goal.icon || 'PiggyBank'] || <PiggyBank className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{goal.title}</h3>
                    {goal.deadline && (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" /> Target: {goal.deadline}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-black font-mono text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/60">
                  {percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-emerald-400">{formatINR(goal.currentAmount)}</span>
                  <span className="text-slate-500">Target {formatINR(goal.targetAmount)}</span>
                </div>
              </div>

              {/* Bottom: Remaining + Deposit Button */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {remaining > 0 ? `${formatINR(remaining)} to go` : 'Goal achieved! 🎉'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGoalForDeposit(goal)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Deposit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deposit Modal */}
      {selectedGoalForDeposit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedGoalForDeposit(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Deposit to Goal</h3>
              <button
                onClick={() => setSelectedGoalForDeposit(null)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Allocate savings to <strong>{selectedGoalForDeposit.title}</strong>
            </p>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
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
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Confirm Deposit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Goal Modal */}
      {showNewGoalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowNewGoalModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Savings Goal</h3>
              <button
                onClick={() => setShowNewGoalModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Goal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip, New Bike, Emergency Fund"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Amount (INR ₹)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 50000"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Initial Saved Amount
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newCurrent}
                  onChange={(e) => setNewCurrent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Target Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all"
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
}
