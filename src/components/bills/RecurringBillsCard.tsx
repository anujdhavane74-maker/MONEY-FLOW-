'use client';

import React, { useState, memo } from 'react';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Zap,
  X,
  CreditCard,
} from 'lucide-react';
import { RecurringBill } from '@/lib/types';
import { formatINR } from '@/lib/formatters';
import { db, markBillPaid } from '@/lib/db';

interface RecurringBillsCardProps {
  bills: RecurringBill[];
  onRefresh: () => void;
}

export const RecurringBillsCard = memo(function RecurringBillsCard({ bills, onRefresh }: RecurringBillsCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Rent & Bills');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [dueDate, setDueDate] = useState('');
  const [autoPay, setAutoPay] = useState(false);

  // Date calculations: identify bills due within 7 days
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const getDaysUntilDue = (dateStr: string) => {
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const activeBills = bills.filter((b) => b.isActive);
  const totalMonthlyCommitments = activeBills.reduce((sum, b) => {
    return sum + (b.billingCycle === 'monthly' ? b.amount : Math.round(b.amount / 12));
  }, 0);

  const upcomingSoon = activeBills.filter((b) => {
    const days = getDaysUntilDue(b.nextDueDate);
    return days >= 0 && days <= 7;
  });

  const handleMarkPaid = async (billId: string) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // ignore
      }
    }
    await markBillPaid(billId);
    onRefresh();
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0 || !dueDate) return;

    await db.recurring_bills.add({
      id: `bill-${Date.now()}`,
      title: title.trim(),
      amount: amt,
      category,
      billingCycle: cycle,
      nextDueDate: dueDate,
      autoPay,
      isActive: true,
      createdAt: Date.now(),
    });

    setTitle('');
    setAmount('');
    setDueDate('');
    setShowAddModal(false);
    onRefresh();
  };

  return (
    <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-3.5 sm:space-y-4 transition-colors min-w-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 truncate">
                Recurring Bills
              </h2>
              <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 font-bold tabular-nums shrink-0">
                {activeBills.length} Active
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Auto-feeds into Safe-to-Spend formula to protect month-end cash
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Add Bill</span>
        </button>
      </div>

      {/* Monthly Commitment Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-gradient-to-r dark:from-amber-950/30 dark:to-slate-900 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block truncate">
            Monthly Fixed Commitments:
          </span>
          <p className="text-lg sm:text-xl font-black font-mono text-amber-800 dark:text-amber-300 tabular-nums truncate">
            {formatINR(totalMonthlyCommitments)}
          </p>
        </div>
        <div className="text-right text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <span>Protected from daily spend</span>
        </div>
      </div>

      {/* Urgent 7-Day Alert Banner if any */}
      {upcomingSoon.length > 0 && (
        <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate min-w-0">
            <strong>{upcomingSoon.length} bill{upcomingSoon.length > 1 ? 's' : ''} due in 7 days:</strong>{' '}
            {upcomingSoon.map((b) => b.title).join(', ')}.
          </span>
        </div>
      )}

      {/* Bills List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 min-w-0">
        {activeBills.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">
            No recurring bills tracked yet. Add your rent or subscriptions!
          </p>
        ) : (
          activeBills.map((bill) => {
            const daysLeft = getDaysUntilDue(bill.nextDueDate);
            const isDueSoon = daysLeft >= 0 && daysLeft <= 7;
            const isPastDue = daysLeft < 0;

            return (
              <div
                key={bill.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 px-1 sm:px-2 rounded-2xl transition-colors min-w-0"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isPastDue
                        ? 'bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400'
                        : isDueSoon
                        ? 'bg-amber-50 border border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400'
                        : 'bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">{bill.title}</span>
                      {bill.autoPay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 border border-cyan-300 text-cyan-800 dark:bg-cyan-950/60 dark:border-cyan-800/50 dark:text-cyan-300 font-semibold flex items-center gap-0.5 shrink-0">
                          <Zap className="w-2.5 h-2.5" /> Auto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span>Due: {bill.nextDueDate}</span>
                      <span>•</span>
                      <span
                        className={`font-semibold tabular-nums shrink-0 ${
                          isPastDue
                            ? 'text-rose-600 dark:text-rose-400'
                            : isDueSoon
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {isPastDue
                          ? `${Math.abs(daysLeft)}d overdue`
                          : daysLeft === 0
                          ? 'Due today!'
                          : `in ${daysLeft}d`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-10 sm:pl-0 shrink-0">
                  <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {formatINR(bill.amount)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleMarkPaid(bill.id)}
                    className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                    title="Logs payment into ledger and advances due date by 1 month"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Paid</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Recurring Bill Modal (Bottom-sheet on mobile) */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-4 sm:p-5 text-slate-900 dark:text-slate-100 space-y-3 shadow-2xl max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Add Recurring Commitment</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Service / Bill Title</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Gym Membership, Room Rent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 799"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Frequency</label>
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value as any)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Rent & Bills">Rent & Bills</option>
                  <option value="Subscriptions & Gaming">Subscriptions & Gaming</option>
                  <option value="Food & Dining">Food & Dining (Mess/Tiffin)</option>
                  <option value="Stationery & Education">Stationery & Education (Tuition)</option>
                  <option value="Savings & Investments">Savings (SIP)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autopay"
                  checked={autoPay}
                  onChange={(e) => setAutoPay(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-100 border-slate-300 dark:bg-slate-700 dark:border-slate-600"
                />
                <label htmlFor="autopay" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Auto-debit enabled (AutoPay)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Save Recurring Commitment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

RecurringBillsCard.displayName = 'RecurringBillsCard';
