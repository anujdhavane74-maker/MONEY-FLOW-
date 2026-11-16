'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldCheck, ShieldAlert, X, Clock, Trash2, Fingerprint, CheckCircle2 } from 'lucide-react';
import { hashPin, verifyPin } from '@/lib/crypto';
import { db } from '@/lib/db';
import { AppSettings } from '@/lib/types';
import {
  isBiometricsSupported,
  isBiometricEnrolled,
  enrollBiometrics,
  disableBiometrics,
} from '@/lib/sessionAuth';

interface PinSettingsModalProps {
  settings: AppSettings | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function PinSettingsModal({ settings, onClose, onUpdated }: PinSettingsModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(settings?.autoLockMinutes ?? 5);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'view' | 'change' | 'create'>('view');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setBiometricsAvailable(supported);
      if (supported) {
        setBiometricsEnrolled(isBiometricEnrolled());
      }
    });
  }, []);

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

  const handleToggleBiometrics = async () => {
    if (biometricLoading) return;
    setError('');
    setSuccess('');

    if (biometricsEnrolled) {
      disableBiometrics();
      setBiometricsEnrolled(false);
      setSuccess('Biometric unlock disabled.');
      return;
    }

    setBiometricLoading(true);
    const res = await enrollBiometrics();
    setBiometricLoading(false);

    if (res.success) {
      setBiometricsEnrolled(true);
      setSuccess('Fingerprint / Face ID successfully enrolled for 1-tap unlock!');
    } else if (res.error) {
      setError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 text-slate-900 dark:text-slate-100 flex flex-col max-h-[90dvh] overflow-y-auto">
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2 sm:hidden shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">App Security & PIN</h2>
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

              {/* Auto-Lock Duration Selection (Google Pay Style) */}
              <div className="pt-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    Auto-Lock Inactivity Timer
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {autoLockMinutes === 0 ? 'Never (manual only)' : `Locks after ${autoLockMinutes} min`}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 1, label: '1 min' },
                    { val: 5, label: '5 min' },
                    { val: 15, label: '15 min' },
                    { val: 0, label: 'Never' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => handleUpdateAutoLock(item.val)}
                      className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                        autoLockMinutes === item.val
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-300 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Biometric Quick Unlock (Fingerprint / Face ID) */}
              {isPinEnabled && (
                <div className="pt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        Fingerprint / Face ID
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {biometricsAvailable
                          ? biometricsEnrolled
                            ? '1-tap biometric unlock active'
                            : 'Enable 1-tap biometric unlock'
                          : 'Not supported on this browser'}
                      </p>
                    </div>
                  </div>

                  {biometricsAvailable && (
                    <button
                      type="button"
                      onClick={handleToggleBiometrics}
                      disabled={biometricLoading}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        biometricsEnrolled
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xs'
                      }`}
                    >
                      {biometricLoading
                        ? 'Enrolling...'
                        : biometricsEnrolled
                        ? 'Disable'
                        : 'Enable'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
