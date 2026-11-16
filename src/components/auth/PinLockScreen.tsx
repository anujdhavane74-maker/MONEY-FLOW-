'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ShieldAlert, CheckCircle2, KeyRound, AlertOctagon } from 'lucide-react';
import { verifyPin, hashPin } from '@/lib/crypto';
import { db } from '@/lib/db';

interface PinLockScreenProps {
  storedHash: string | null;
  onUnlock: () => void;
  isInitialSetup?: boolean;
  onPinCreated?: (newHash: string) => void;
}

const STORAGE_KEY_FAILED = 'mf_pin_failed_attempts';
const STORAGE_KEY_LOCKOUT = 'mf_pin_lockout_until';

export function PinLockScreen({
  storedHash,
  onUnlock,
  isInitialSetup = false,
  onPinCreated,
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [step, setStep] = useState<'enter' | 'create' | 'confirm'>(
    isInitialSetup || !storedHash ? 'create' : 'enter'
  );
  const [firstEnteredPin, setFirstEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState<number>(0);

  // Check existing lockout on mount
  useEffect(() => {
    try {
      const lockoutUntil = Number(localStorage.getItem(STORAGE_KEY_LOCKOUT) || '0');
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutSecondsLeft(Math.ceil((lockoutUntil - now) / 1000));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Ticking cooldown timer
  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(STORAGE_KEY_LOCKOUT);
          } catch (e) {
            // ignore
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSecondsLeft]);

  // Trigger error shake, record failed attempt & calculate exponential lockout
  const triggerError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    let failed = 0;
    try {
      failed = Number(localStorage.getItem(STORAGE_KEY_FAILED) || '0') + 1;
      localStorage.setItem(STORAGE_KEY_FAILED, String(failed));

      let lockoutDuration = 0;
      if (failed >= 10) {
        lockoutDuration = 900; // 15 minutes lockout
      } else if (failed >= 5) {
        lockoutDuration = 60; // 60 seconds lockout
      } else if (failed >= 3) {
        lockoutDuration = 30; // 30 seconds lockout
      }

      if (lockoutDuration > 0) {
        const lockoutUntil = Date.now() + lockoutDuration * 1000;
        localStorage.setItem(STORAGE_KEY_LOCKOUT, String(lockoutUntil));
        setLockoutSecondsLeft(lockoutDuration);
      }
    } catch (e) {
      // ignore
    }

    setTimeout(() => {
      setPin('');
      setIsShaking(false);
    }, 500);
  }, []);

  // Clear failed attempts counter on correct unlock
  const handleSuccessfulUnlock = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_FAILED);
      localStorage.removeItem(STORAGE_KEY_LOCKOUT);
    } catch (e) {
      // ignore
    }
    setIsSuccess(true);
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(50);
    }
    setTimeout(() => {
      onUnlock();
    }, 300);
  }, [onUnlock]);

  // Handle PIN completion logic
  useEffect(() => {
    if (pin.length !== 4) return;
    if (lockoutSecondsLeft > 0) {
      setPin('');
      return;
    }

    const handlePin = async () => {
      if (step === 'enter') {
        if (!storedHash) {
          handleSuccessfulUnlock();
          return;
        }

        const isValid = await verifyPin(pin, storedHash);
        if (isValid) {
          handleSuccessfulUnlock();
        } else {
          triggerError('Incorrect PIN. Please try again.');
        }
      } else if (step === 'create') {
        setFirstEnteredPin(pin);
        setPin('');
        setStep('confirm');
        setErrorMsg('');
      } else if (step === 'confirm') {
        if (pin === firstEnteredPin) {
          const newHash = await hashPin(pin);
          // Save in database
          await db.app_settings.update('global', {
            pinHash: newHash,
            pinEnabled: true,
          });
          setIsSuccess(true);
          if (onPinCreated) {
            onPinCreated(newHash);
          }
          setTimeout(() => {
            onUnlock();
          }, 350);
        } else {
          triggerError('PINs do not match. Start again.');
          setStep('create');
          setFirstEnteredPin('');
        }
      }
    };

    handlePin();
  }, [pin, step, storedHash, firstEnteredPin, lockoutSecondsLeft, onUnlock, onPinCreated, triggerError, handleSuccessfulUnlock]);

  // Physical keyboard support (disabled during lockout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutSecondsLeft > 0) return;

      if (/^[0-9]$/.test(e.key)) {
        setPin((prev) => (prev.length < 4 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPin('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lockoutSecondsLeft]);

  const handleDigit = (digit: string) => {
    if (lockoutSecondsLeft > 0) return;
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (lockoutSecondsLeft > 0) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (lockoutSecondsLeft > 0) return;
    setPin('');
  };

  const isLockedOut = lockoutSecondsLeft > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-xl p-6 select-none text-white overflow-hidden">
      {/* Top Section */}
      <div className="w-full max-w-xs flex flex-col items-center pt-8 text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/50">
            {isSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : isLockedOut ? (
              <AlertOctagon className="w-8 h-8 text-rose-400 animate-pulse" />
            ) : step === 'enter' ? (
              <Lock className="w-8 h-8 text-emerald-400" />
            ) : (
              <KeyRound className="w-8 h-8 text-cyan-400" />
            )}
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-20 blur-md -z-10" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-100">
          {isLockedOut && 'Numpad Locked'}
          {!isLockedOut && step === 'enter' && 'Money Flow Locked'}
          {!isLockedOut && step === 'create' && 'Create 4-Digit PIN'}
          {!isLockedOut && step === 'confirm' && 'Confirm Your PIN'}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {isLockedOut && `Too many failed attempts. Please wait.`}
          {!isLockedOut && step === 'enter' && 'Enter your PIN to access your finance vault'}
          {!isLockedOut && step === 'create' && 'Set a 4-digit code to protect your transactions'}
          {!isLockedOut && step === 'confirm' && 'Re-enter your 4 digits to confirm'}
        </p>

        {/* Lockout Banner */}
        {isLockedOut ? (
          <div className="my-6 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fade-in font-medium">
            <AlertOctagon className="w-4 h-4 text-rose-400 flex-shrink-0 animate-spin-slow" />
            <span>
              Brute-force protection: Try again in{' '}
              <strong className="font-mono text-white text-sm">{lockoutSecondsLeft}s</strong>
            </span>
          </div>
        ) : (
          /* 4-Digit Dots */
          <div
            className={`flex items-center gap-5 my-8 transition-transform ${
              isShaking ? 'translate-x-[-8px] animate-pulse' : ''
            }`}
          >
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    isFilled
                      ? isSuccess
                        ? 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-400/50'
                        : 'bg-emerald-400 scale-110 shadow-md shadow-emerald-400/40'
                      : 'bg-slate-800 border-2 border-slate-700'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Error Message */}
        {errorMsg && !isLockedOut ? (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 px-3 py-1.5 rounded-full border border-rose-800/40 animate-fade-in">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="h-6" />
        )}
      </div>

      {/* Numeric Keypad (Disabled during lockout) */}
      <div className={`w-full max-w-xs grid grid-cols-3 gap-4 pb-8 transition-opacity ${isLockedOut ? 'opacity-30 pointer-events-none' : ''}`}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleDigit(num.toString())}
            disabled={isLockedOut}
            type="button"
            className="h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 active:bg-emerald-500/20 active:scale-95 border border-slate-800 hover:border-slate-700 text-2xl font-semibold tracking-wider text-slate-100 flex items-center justify-center transition-all duration-150 shadow-sm disabled:cursor-not-allowed"
          >
            {num}
          </button>
        ))}

        {/* Clear Button */}
        <button
          onClick={handleClear}
          disabled={isLockedOut}
          type="button"
          className="h-16 rounded-2xl bg-transparent active:bg-slate-900 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-300 flex items-center justify-center transition-all disabled:opacity-30"
        >
          Clear
        </button>

        {/* Digit 0 */}
        <button
          onClick={() => handleDigit('0')}
          disabled={isLockedOut}
          type="button"
          className="h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 active:bg-emerald-500/20 active:scale-95 border border-slate-800 hover:border-slate-700 text-2xl font-semibold tracking-wider text-slate-100 flex items-center justify-center transition-all duration-150 shadow-sm disabled:cursor-not-allowed"
        >
          0
        </button>

        {/* Backspace Button */}
        <button
          onClick={handleBackspace}
          disabled={isLockedOut}
          type="button"
          className="h-16 rounded-2xl bg-slate-900/40 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all disabled:opacity-30"
          aria-label="Backspace"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Footer Branding */}
      <div className="pb-4 text-center">
        <span className="text-[11px] uppercase tracking-widest text-slate-600 font-medium">
          Offline Vault • Salted SHA-256 PIN • Anti-Brute Force
        </span>
      </div>
    </div>
  );
}
