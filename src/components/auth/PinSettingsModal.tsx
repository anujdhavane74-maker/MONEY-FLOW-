'use client';

import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, ShieldAlert, X, Clock, Trash2 } from 'lucide-react';
import { hashPin, verifyPin } from '@/lib/crypto';
import { db } from '@/lib/db';
import { AppSettings } from '@/lib/types';

interface PinSettingsModalProps {
  settings: AppSettings | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function PinSettingsModal({ settings, onClose, onUpdated }: PinSettingsModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(settings?.autoLockMinutes || 5);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'view' | 'change' | 'create'>('view');

  const isPinEnabled = Boolean(settings?.pinEnabled && settings?.pinHash);

  const handleCreateOrChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // If changing, verify old PIN first
    if (isPinEnabled && settings?.pinHash) {
      if (currentPin.length !== 4) {
        setError('Please enter your current 4-digit PIN');
        return;
      }
      const isOldValid = await verifyPin(currentPin, settings.pinHash);
      if (!isOldValid) {
        setError('Current PIN is incorrect');
        return;
      }
    }

    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('New PIN must be exactly 4 numeric digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Confirmation PIN does not match');
      return;
    }

    const hashed = await hashPin(newPin);
    await db.app_settings.update('global', {
      pinHash: hashed,
      pinEnabled: true,
      autoLockMinutes,
    });

    setSuccess('4-Digit Security PIN successfully updated!');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setMode('view');
    onUpdated();
  };

  const handleDisablePin = async () => {
    if (isPinEnabled && settings?.pinHash) {
      const entered = prompt('Please enter your current 4-digit PIN to disable lock:');
      if (!entered) return;
      const isValid = await verifyPin(entered, settings.pinHash);
      if (!isValid) {
        alert('Incorrect PIN. Security lock remains active.');
        return;
      }
    }

    await db.app_settings.update('global', {
      pinEnabled: false,
      pinHash: null,
    });

    setSuccess('PIN lock disabled.');
    onUpdated();
  };

  const handleUpdateAutoLock = async (mins: number) => {
    setAutoLockMinutes(mins);
    await db.app_settings.update('global', {
      autoLockMinutes: mins,
    });
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">App Security & PIN</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Protect financial privacy & auto-lock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-5">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isPinEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300'
                : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {isPinEnabled ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {isPinEnabled ? 'PIN Protection Active' : 'No PIN Set'}
                </p>
                <p className="text-xs opacity-90">
                  {isPinEnabled
                    ? `Locks after ${autoLockMinutes} minutes of inactivity`
                    : 'Your transactions are currently unprotected'}
                </p>
              </div>
            </div>
            {isPinEnabled && (
              <button
                type="button"
                onClick={handleDisablePin}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Disable
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Change or Create Form */}
          {mode !== 'view' ? (
            <form onSubmit={handleCreateOrChangePin} className="space-y-4">
              {isPinEnabled && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Current 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-center tracking-[0.5em] text-lg font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-center tracking-[0.5em] text-lg font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-center tracking-[0.5em] text-lg font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  Save PIN
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode(isPinEnabled ? 'change' : 'create')}
                className="w-full py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {isPinEnabled ? 'Change 4-Digit PIN' : 'Set Up 4-Digit PIN Now'}
              </button>

              {/* Auto-Lock Duration Selection */}
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Auto-Lock Timer (Inactivity)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 5, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleUpdateAutoLock(mins)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                        autoLockMinutes === mins
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
