'use client';

import React, { useState, useMemo, memo } from 'react';
import {
  Users,
  Search,
  Plus,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Share2,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
  TrendingDown,
} from 'lucide-react';
import { IOU } from '@/lib/types';
import { formatINR, formatISTDate } from '@/lib/formatters';
import { db, settleIOU, settleAllIOUsForPerson } from '@/lib/db';
import { SarcasticCardStudioModal } from './SarcasticCardStudioModal';

interface SplitsViewProps {
  ious: IOU[];
  onRefresh: () => void;
  defaultUpiId?: string;
  onSaveUpiId?: (upi: string) => void;
}

interface FriendDebtGroup {
  friendName: string;
  totalAmount: number;
  pendingCount: number;
  settledCount: number;
  oldestCreatedAt: number;
  newestCreatedAt: number;
  ious: IOU[];
}

export const SplitsView = memo(function SplitsView({
  ious,
  onRefresh,
  defaultUpiId,
  onSaveUpiId,
}: SplitsViewProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'settled' | 'all'>('pending');
  const [mobileTab, setMobileTab] = useState<'friends' | 'all_items'>('friends');

  // Expanded friend dossiers
  const [expandedFriends, setExpandedFriends] = useState<Record<string, boolean>>({});

  // Add Manual IOU Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Sarcastic Studio Target State
  const [roastTarget, setRoastTarget] = useState<{
    friendName: string;
    friendIOUs: IOU[];
    selectedIouId?: string;
  } | null>(null);

  // Group IOUs by friend
  const { friendGroups, totalPendingAmount, totalSettledAmount, totalPendingCount, oldestPendingDays } =
    useMemo(() => {
      const now = Date.now();
      const dayMs = 86400000;
      const groupsMap: Record<string, FriendDebtGroup> = {};

      let totalPending = 0;
      let totalSettled = 0;
      let pendingCount = 0;
      let oldestTime = now;

      ious.forEach((iou) => {
        const key = iou.personName.trim();
        if (!groupsMap[key]) {
          groupsMap[key] = {
            friendName: key,
            totalAmount: 0,
            pendingCount: 0,
            settledCount: 0,
            oldestCreatedAt: iou.createdAt,
            newestCreatedAt: iou.createdAt,
            ious: [],
          };
        }

        const grp = groupsMap[key];
        grp.ious.push(iou);

        if (iou.status === 'pending') {
          grp.totalAmount += iou.amount;
          grp.pendingCount += 1;
          totalPending += iou.amount;
          pendingCount += 1;
          if (iou.createdAt < oldestTime) {
            oldestTime = iou.createdAt;
          }
        } else {
          grp.settledCount += 1;
          totalSettled += iou.amount;
        }

        if (iou.createdAt < grp.oldestCreatedAt) grp.oldestCreatedAt = iou.createdAt;
        if (iou.createdAt > grp.newestCreatedAt) grp.newestCreatedAt = iou.createdAt;
      });

      // Sort friends: highest pending debt first
      const sortedGroups = Object.values(groupsMap).sort((a, b) => b.totalAmount - a.totalAmount);

      const oldestDays = pendingCount > 0 ? Math.max(1, Math.floor((now - oldestTime) / dayMs)) : 0;

      return {
        friendGroups: sortedGroups,
        totalPendingAmount: totalPending,
        totalSettledAmount: totalSettled,
        totalPendingCount: pendingCount,
        oldestPendingDays: oldestDays,
      };
    }, [ious]);

  // Filtered list of raw individual items
  const filteredItems = useMemo(() => {
    return ious
      .filter((i) => {
        if (statusFilter === 'pending') return i.status === 'pending';
        if (statusFilter === 'settled') return i.status === 'settled';
        return true;
      })
      .filter((i) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          i.personName.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [ious, statusFilter, searchQuery]);

  // Filtered friends
  const filteredFriends = useMemo(() => {
    return friendGroups.filter((f) => {
      if (statusFilter === 'pending' && f.totalAmount <= 0) return false;
      if (statusFilter === 'settled' && f.totalAmount > 0 && f.settledCount === 0) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.friendName.toLowerCase().includes(q) ||
        f.ious.some((i) => i.description && i.description.toLowerCase().includes(q))
      );
    });
  }, [friendGroups, statusFilter, searchQuery]);

  // Actions
  const handleSettleSingle = async (iouId: string) => {
    await settleIOU(iouId);
    onRefresh();
  };

  const handleSettleAllForFriend = async (friendName: string) => {
    if (!confirm(`Mark all pending split bills for ${friendName} as settled?`)) return;
    await settleAllIOUsForPerson(friendName);
    onRefresh();
  };

  const handleOpenRoastStudio = (friendName: string, selectedIouId?: string) => {
    const friendIOUs = ious.filter(
      (i) => i.personName.trim().toLowerCase() === friendName.trim().toLowerCase() && i.status === 'pending'
    );
    if (friendIOUs.length === 0) {
      alert(`No pending debts found for ${friendName}!`);
      return;
    }
    setRoastTarget({
      friendName,
      friendIOUs,
      selectedIouId,
    });
  };

  const handleCreateNewIOU = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(newAmount);
    if (!newFriendName.trim() || isNaN(parsedAmt) || parsedAmt <= 0) return;

    await db.ious.add({
      id: `iou-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      personName: newFriendName.trim(),
      amount: parsedAmt,
      status: 'pending',
      description: newDescription.trim() || 'Split Expense',
      createdAt: Date.now(),
    });

    setNewFriendName('');
    setNewAmount('');
    setNewDescription('');
    setShowAddModal(false);
    onRefresh();
  };

  const toggleExpandFriend = (friendName: string) => {
    setExpandedFriends((prev) => ({
      ...prev,
      [friendName]: !prev[friendName],
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 w-full animate-fade-in pb-16">
      {/* Top Banner: Hub Header & Primary CTA */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                Splits & IOU Recovery Hub
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
                Sarcastic Card Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Collect receivables with medical prescriptions, fake bank notices, and meme receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Split Bill</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        {/* Metric 1: Total Pending Receivables */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-cyan-200 dark:border-cyan-800/50 shadow-sm dark:shadow-md space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span className="truncate">Owed to You</span>
            <DollarSign className="w-4 h-4 text-cyan-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 truncate tabular-nums">
            {formatINR(totalPendingAmount)}
          </p>
          <span className="text-[10px] text-slate-400 block truncate">
            {totalPendingCount} pending split bills
          </span>
        </div>

        {/* Metric 2: Active Friends Who Owe You */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span className="truncate">Active Debtors</span>
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono text-slate-900 dark:text-white truncate tabular-nums">
            {friendGroups.filter((f) => f.totalAmount > 0).length}
          </p>
          <span className="text-[10px] text-slate-400 block truncate">
            Friends with unpaid balances
          </span>
        </div>

        {/* Metric 3: Oldest Unpaid Debt */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span className="truncate">Oldest Debt</span>
            <Clock className="w-4 h-4 text-red-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono text-red-500 dark:text-red-400 truncate tabular-nums">
            {oldestPendingDays > 0 ? `${oldestPendingDays}d ago` : '0 days'}
          </p>
          <span className="text-[10px] text-slate-400 block truncate">
            Maximum days overdue
          </span>
        </div>

        {/* Metric 4: All-Time Settled Amount */}
        <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-md space-y-1 min-w-0">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span className="truncate">Total Settled</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          </div>
          <p className="text-lg sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
            {formatINR(totalSettledAmount)}
          </p>
          <span className="text-[10px] text-slate-400 block truncate">
            Recovered without drama
          </span>
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            placeholder="Search by friend name, Dhaba, Swiggy, Auto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 min-h-[38px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'pending'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pending ({totalPendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('settled')}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'settled'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Settled
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Mobile Tab Switcher (< 1024px: "By Friend Dossiers" vs "All Splits Feed") */}
      <div className="lg:hidden grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMobileTab('friends')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
            mobileTab === 'friends'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          By Friend ({filteredFriends.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('all_items')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors ${
            mobileTab === 'all_items'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          All Split Bills ({filteredItems.length})
        </button>
      </div>

      {/* Main Grid: Multi-Column on Desktop (>= 1024px), Segmented on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0 items-start">
        {/* Left Column (5 cols on lg): Debtor Leaderboard & Dossiers */}
        <div
          className={`lg:col-span-5 space-y-3.5 min-w-0 ${
            mobileTab === 'all_items' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-500" />
              Debtor Leaderboard & Dossiers
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {filteredFriends.length} Friends
            </span>
          </div>

          {filteredFriends.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No debts found matching your filters!
              </p>
              <p className="text-xs text-slate-400">
                Everyone is fully settled, or try clearing your search query.
              </p>
            </div>
          ) : (
            filteredFriends.map((friend) => {
              const isExpanded = Boolean(expandedFriends[friend.friendName]);
              const pendingIOUsForFriend = friend.ious.filter((i) => i.status === 'pending');
              const hasPending = friend.totalAmount > 0;

              return (
                <div
                  key={friend.friendName}
                  className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 p-4 shadow-sm dark:shadow-md space-y-3 transition-all min-w-0 overflow-hidden"
                >
                  {/* Friend Header Row */}
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-600 dark:text-cyan-400 text-sm shrink-0">
                        {friend.friendName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                            {friend.friendName}
                          </h3>
                          {friend.pendingCount > 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold shrink-0">
                              {friend.pendingCount} Bills
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {hasPending
                            ? `Owes ${formatINR(friend.totalAmount)} total`
                            : 'All shared bills settled!'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-black font-mono text-cyan-600 dark:text-cyan-400 tabular-nums block">
                        {formatINR(friend.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Primary Recovery Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {hasPending && (
                      <button
                        type="button"
                        onClick={() => handleOpenRoastStudio(friend.friendName)}
                        className="flex-1 py-2 px-3 min-h-[38px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Roast & Collect 💸</span>
                      </button>
                    )}

                    {hasPending && (
                      <button
                        type="button"
                        onClick={() => handleSettleAllForFriend(friend.friendName)}
                        className="py-2 px-3 min-h-[38px] rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1 transition-colors"
                        title="Mark all bills settled"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle All</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpandFriend(friend.friendName)}
                      className="p-2 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                      title="Toggle itemized breakdown"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Itemized Bills Accordion */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 animate-slide-down">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block pb-1">
                        Itemized Bills History:
                      </span>
                      {friend.ious.map((iou) => (
                        <div
                          key={iou.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs min-w-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {iou.description || 'Split Expense'}
                            </p>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {formatISTDate(iou.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatINR(iou.amount)}
                            </span>
                            {iou.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => handleSettleSingle(iou.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20"
                              >
                                Settle
                              </button>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                                Settled
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (7 cols on lg): All Split Bills Feed */}
        <div
          className={`lg:col-span-7 space-y-3.5 min-w-0 ${
            mobileTab === 'friends' ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Detailed Split Activity Stream
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {filteredItems.length} Transactions
            </span>
          </div>

          <div className="space-y-2.5 min-w-0">
            {filteredItems.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No split bills in this view!
                </p>
                <p className="text-xs text-slate-400">
                  Tap &ldquo;Add Split Bill&rdquo; above to record a new shared expense.
                </p>
              </div>
            ) : (
              filteredItems.map((iou) => (
                <div
                  key={iou.id}
                  className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/25 flex items-center justify-center font-bold text-cyan-700 dark:text-cyan-300 text-xs shrink-0">
                      {iou.personName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {iou.personName}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                          {formatISTDate(iou.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {iou.description || 'Split Expense'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0 shrink-0">
                    <span className="text-sm sm:text-base font-black font-mono text-cyan-600 dark:text-cyan-400 tabular-nums">
                      {formatINR(iou.amount)}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {iou.status === 'pending' ? (
                        <>
                          {/* Sarcastic Roast Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenRoastStudio(iou.personName, iou.id)}
                            className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Generate sarcastic reminder card"
                          >
                            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Roast</span>
                          </button>

                          {/* Settle Button */}
                          <button
                            type="button"
                            onClick={() => handleSettleSingle(iou.id)}
                            className="px-2.5 py-1.5 min-h-[36px] rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Mark settled"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Settle</span>
                          </button>
                        </>
                      ) : (
                        <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Settled</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Manual Add Split IOU Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-slate-900 dark:text-slate-100 space-y-4 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Add New Split Bill
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewIOU} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Friend&apos;s Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul, Sneha, Amit, Vikram"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Amount Owed (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 250"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Reason / Item Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dhaba Paneer Dinner, Swiggy Biryani, Auto Fare"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-md"
              >
                Record Split Bill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sarcastic Studio Modal */}
      {roastTarget && (
        <SarcasticCardStudioModal
          friendName={roastTarget.friendName}
          friendIOUs={roastTarget.friendIOUs}
          selectedIouId={roastTarget.selectedIouId}
          defaultUpiId={defaultUpiId}
          onSaveUpiId={onSaveUpiId}
          onClose={() => setRoastTarget(null)}
        />
      )}
    </div>
  );
});
