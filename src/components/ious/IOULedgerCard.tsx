'use client';

import React, { useState, memo } from 'react';
import {
  Users,
  CheckCircle2,
  Plus,
  X,
  MessageCircle,
} from 'lucide-react';
import { IOU } from '@/lib/types';
import { formatINR, formatISTDate } from '@/lib/formatters';
import { db, settleIOU } from '@/lib/db';

interface IOULedgerCardProps {
  ious: IOU[];
  onRefresh: () => void;
}

export const IOULedgerCard = memo(function IOULedgerCard({ ious, onRefresh }: IOULedgerCardProps) {
  const [showAddIou, setShowAddIou] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const pendingIOUs = ious.filter((i) => i.status === 'pending');
  const totalOwedToMe = pendingIOUs.reduce((sum, i) => sum + i.amount, 0);

  const handleSettle = async (id: string) => {
    await settleIOU(id);
    onRefresh();
  };

  const handleSendReminder = (iou: IOU) => {
    const formattedAmt = formatINR(iou.amount);
    const dateStr = formatISTDate(iou.createdAt);
    const text = encodeURIComponent(
      `Hey ${iou.personName}, just a gentle reminder regarding ${formattedAmt} for ${iou.description} (${dateStr}). You can GPay / UPI me at your convenience! Thanks!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleCreateManualIOU = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmt) || parsedAmt <= 0) return;

    await db.ious.add({
      id: `iou-${Date.now()}`,
      personName: name.trim(),
      amount: parsedAmt,
      status: 'pending',
      description: desc.trim() || 'Split Expense',
      createdAt: Date.now(),
    });

    setName('');
    setAmount('');
    setDesc('');
    setShowAddIou(false);
    onRefresh();
  };

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Split & IOU Ledger
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300 font-bold tabular-nums">
                {pendingIOUs.length} Pending
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personal spending stays clean while tracking group receivables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddIou(true)}
            className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">Add IOU</span>
          </button>
        </div>
      </div>

      {/* Top Total Owed Banner */}
      <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-gradient-to-r dark:from-cyan-950/40 dark:to-blue-950/20 border border-cyan-200 dark:border-cyan-800/40 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
            Total Money Owed to You:
          </span>
          <p className="text-xl font-black font-mono text-cyan-800 dark:text-cyan-300 tabular-nums">
            {formatINR(totalOwedToMe)}
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
          <span>Excluded from personal burn rate</span>
        </div>
      </div>

      {/* Manual IOU Modal */}
      {showAddIou && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddIou(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 text-slate-900 dark:text-slate-100 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Record Pending IOU</span>
              <button
                onClick={() => setShowAddIou(false)}
                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualIOU} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Friend Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul, Priya, Amit"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Amount Owed (₹)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 200"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Reason / Description</label>
                <input
                  type="text"
                  placeholder="e.g. Dinner at Dhaba, Movie Ticket"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors"
              >
                Record IOU
              </button>
            </form>
          </div>
        </div>
      )}

      {/* List of Pending Friends */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {pendingIOUs.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">
            No pending IOUs! All shared expenses are settled.
          </p>
        ) : (
          pendingIOUs.map((iou) => (
            <div
              key={iou.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 px-2 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-300 dark:border-cyan-500/30 flex items-center justify-center font-bold text-xs text-cyan-800 dark:text-cyan-300">
                  {iou.personName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{iou.personName}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {formatISTDate(iou.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{iou.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                <span className="text-sm font-black font-mono text-cyan-700 dark:text-cyan-300 tabular-nums">
                  {formatINR(iou.amount)}
                </span>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp Reminder Button */}
                  <button
                    type="button"
                    onClick={() => handleSendReminder(iou)}
                    className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Send friendly WhatsApp reminder"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Remind</span>
                  </button>

                  {/* 1-Tap Settle Button */}
                  <button
                    type="button"
                    onClick={() => handleSettle(iou.id)}
                    className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Mark settled"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Settle</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
