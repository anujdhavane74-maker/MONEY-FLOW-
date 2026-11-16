'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  X,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  Sparkles,
  Calendar,
  CreditCard,
  Tag,
  FileText,
  Users,
  Trash2,
} from 'lucide-react';
import { TransactionType, Category } from '@/lib/types';
import { db, predictCategory, learnMerchantRule } from '@/lib/db';
import { formatINR } from '@/lib/formatters';

interface AddTransactionModalProps {
  categories: Category[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddTransactionModal({ categories, onClose, onAdded }: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [bankOrApp, setBankOrApp] = useState<string>('GPay');
  const [upiRefId, setUpiRefId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(
    new Date().toISOString().slice(0, 16) // format YYYY-MM-DDTHH:mm
  );
  const [isAutoPredicted, setIsAutoPredicted] = useState<boolean>(false);

  // Split Expense State
  const [isSplit, setIsSplit] = useState(false);
  const [splitType, setSplitType] = useState<'equal' | 'exact'>('equal');
  const [friendsList, setFriendsList] = useState<Array<{ name: string; amount: number }>>([
    { name: '', amount: 0 },
  ]);

  // Auto-predict category as merchant changes
  useEffect(() => {
    async function checkPrediction() {
      if (merchant.length >= 3) {
        const pred = await predictCategory(merchant);
        if (pred) {
          setCategory(pred);
          setIsAutoPredicted(true);
        }
      }
    }
    checkPrediction();
  }, [merchant]);

  // Set default category when type changes
  useEffect(() => {
    const available = categories.filter((c) => c.type === type);
    if (available.length > 0 && (!category || !available.some((c) => c.name === category))) {
      setCategory(available[0].name);
    }
  }, [type, categories, category]);

  // Split Calculations
  const parsedTotalAmount = parseFloat(amount) || 0;
  const numFriends = Math.max(1, friendsList.length);

  let myPersonalShare = parsedTotalAmount;
  let computedFriends = friendsList;

  if (isSplit && type === 'expense' && parsedTotalAmount > 0) {
    if (splitType === 'equal') {
      const perPerson = Math.round((parsedTotalAmount / (numFriends + 1)) * 100) / 100;
      computedFriends = friendsList.map((f) => ({ ...f, amount: perPerson }));
      myPersonalShare = Math.max(0, parsedTotalAmount - perPerson * numFriends);
    } else {
      const sumFriends = friendsList.reduce((sum, f) => sum + (f.amount || 0), 0);
      myPersonalShare = Math.max(0, parsedTotalAmount - sumFriends);
      computedFriends = friendsList;
    }
  }

  const handleAddFriend = () => {
    setFriendsList([...friendsList, { name: '', amount: 0 }]);
  };

  const handleRemoveFriend = (idx: number) => {
    if (friendsList.length > 1) {
      setFriendsList(friendsList.filter((_, i) => i !== idx));
    }
  };

  const handleFriendNameChange = (idx: number, name: string) => {
    const updated = [...friendsList];
    updated[idx].name = name;
    setFriendsList(updated);
  };

  const handleFriendAmountChange = (idx: number, amtStr: string) => {
    const updated = [...friendsList];
    updated[idx].amount = parseFloat(amtStr) || 0;
    setFriendsList(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedTotalAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!merchant.trim()) {
      alert('Please enter a merchant or description.');
      return;
    }

    const timestamp = new Date(dateStr).getTime() || Date.now();
    const newTxnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Critical Accounting Rule:
    // Only record 'myPersonalShare' as the transaction amount so personal spending stays accurate!
    await db.transactions.add({
      id: newTxnId,
      amount: isSplit && type === 'expense' ? myPersonalShare : parsedTotalAmount,
      type,
      category: category || 'Other',
      merchant: merchant.trim(),
      bankOrApp,
      upiRefId: uppiTrim(upiRefId),
      notes: notes.trim() || undefined,
      timestamp,
      source: 'manual',
      isCategorized: true,
      isSplit: isSplit && type === 'expense',
      splitTotalAmount: parsedTotalAmount,
      myShareAmount: myPersonalShare,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // If split, add IOUs for each friend
    if (isSplit && type === 'expense') {
      for (const friend of computedFriends) {
        if (friend.name.trim() && friend.amount > 0) {
          await db.ious.add({
            id: `iou-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            transactionId: newTxnId,
            personName: friend.name.trim(),
            amount: friend.amount,
            status: 'pending',
            description: `${merchant.trim()} (Split)`,
            createdAt: timestamp,
          });
        }
      }
    }

    // Auto-learn rule for future
    if (merchant && category) {
      await learnMerchantRule(merchant, category);
    }

    onAdded();
    onClose();
  };

  const uppiTrim = (str: string) => {
    const trimmed = str.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const availableCategories = categories.filter((c) => c.type === type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 flex flex-col max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Add Transaction</h2>
              <p className="text-xs text-slate-400">Log income, expense, or savings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Switcher */}
        <div className="grid grid-cols-3 gap-2 my-4 p-1 rounded-2xl bg-slate-800/80 border border-slate-700/60">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              type === 'expense'
                ? 'bg-rose-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Expense
          </button>
          <button
            type="button"
            onClick={() => {
              setType('income');
              setIsSplit(false);
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              type === 'income'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Income
          </button>
          <button
            type="button"
            onClick={() => {
              setType('savings');
              setIsSplit(false);
            }}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              type === 'savings'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PiggyBank className="w-3.5 h-3.5" />
            Savings
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              {isSplit ? 'Total Bill Paid at Counter' : 'Amount'} (INR ₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-400 font-mono">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-2xl font-black font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Split Expense Toggle (Available for Expenses) */}
          {type === 'expense' && (
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">Split This Bill with Friends</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => setIsSplit(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-700 border-slate-600 cursor-pointer"
                />
              </div>

              {isSplit && (
                <div className="space-y-3 pt-2 border-t border-slate-700/60 animate-fade-in">
                  {/* Split Type Selector */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Method:</span>
                    <button
                      type="button"
                      onClick={() => setSplitType('equal')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        splitType === 'equal'
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Split Equally
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitType('exact')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        splitType === 'exact'
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      Exact Amounts
                    </button>
                  </div>

                  {/* Friends List */}
                  <div className="space-y-2">
                    {friendsList.map((friend, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Friend Name (e.g. Rahul)"
                          value={friend.name}
                          onChange={(e) => handleFriendNameChange(idx, e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                          required={isSplit}
                        />
                        {splitType === 'exact' ? (
                          <input
                            type="number"
                            placeholder="₹ Owed"
                            value={friend.amount || ''}
                            onChange={(e) => handleFriendAmountChange(idx, e.target.value)}
                            className="w-24 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                          />
                        ) : (
                          <span className="px-2.5 py-1.5 rounded-xl bg-slate-900 font-mono text-xs text-cyan-300 font-semibold w-24 text-center">
                            {formatINR(computedFriends[idx]?.amount || 0)}
                          </span>
                        )}
                        {friendsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFriend(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddFriend}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 pt-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Another Friend
                    </button>
                  </div>

                  {/* Accounting Preview Banner */}
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-200 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>Your Personal Share:</span>
                      <span className="font-mono text-emerald-400">{formatINR(myPersonalShare)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Logged to IOU Ledger (Owed to you):</span>
                      <span className="font-mono text-cyan-300">
                        {formatINR(parsedTotalAmount - myPersonalShare)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1">
                      ✅ Only {formatINR(myPersonalShare)} counts toward your daily safe limit and category budget!
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Merchant / Payee */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              {type === 'income' ? 'Received From (Source)' : 'Merchant / Paid To'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={
                  type === 'income'
                    ? 'e.g. Salary, Dad, Freelance Client'
                    : 'e.g. Anand Vadapav, Dhaba, Swiggy'
                }
                value={merchant}
                onChange={(e) => {
                  setMerchant(e.target.value);
                  setIsAutoPredicted(false);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
              {isAutoPredicted && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <Sparkles className="w-3 h-3" />
                  Auto-Tagged
                </div>
              )}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setIsAutoPredicted(false);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grid: Date & Bank/App */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Payment Method</label>
              <select
                value={bankOrApp}
                onChange={(e) => setBankOrApp(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="GPay">Google Pay (UPI)</option>
                <option value="PhonePe">PhonePe</option>
                <option value="Paytm">Paytm</option>
                <option value="Bank of Maharashtra">Bank of Maharashtra</option>
                <option value="State Bank of India">SBI</option>
                <option value="HDFC Bank">HDFC Bank</option>
                <option value="ICICI Bank">ICICI Bank</option>
                <option value="Axis Bank">Axis Bank</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Optional UPI Ref ID */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              UPI Reference / UTR (Optional)
            </label>
            <input
              type="text"
              maxLength={16}
              placeholder="12-digit UTR No. e.g. 418291029182"
              value={upiRefId}
              onChange={(e) => setUpiRefId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Snacks with friends, course books"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-98 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
