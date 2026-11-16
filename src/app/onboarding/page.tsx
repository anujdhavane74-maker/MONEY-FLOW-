'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Globe2,
  DollarSign,
  Lock,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { SUPPORTED_CURRENCIES, setActiveCurrency } from '@/lib/formatters';
import { db } from '@/lib/db';
import { hashPin } from '@/lib/crypto';
import { setUnlockSession } from '@/lib/sessionAuth';
import { QuickSpendPreset } from '@/lib/types';

const REGIONAL_PRESETS: Record<string, QuickSpendPreset[]> = {
  INR: [
    { id: 'preset-chai', name: '☕ Cutting Chai', amount: 15, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-vadapav', name: '🥪 Vadapav', amount: 20, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-bus', name: '🚌 PMPML Bus', amount: 25, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-auto', name: '🛺 Shared Auto', amount: 30, category: 'Travel & Transit', icon: 'Car' },
    { id: 'preset-coffee', name: '🥤 Cold Coffee', amount: 50, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-groceries', name: '🥛 Milk & Eggs', amount: 65, category: 'Shopping', icon: 'ShoppingBag' },
  ],
  USD: [
    { id: 'preset-coffee-us', name: '☕ Iced Latte', amount: 5.5, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-lunch-us', name: '🥪 Deli Sandwich', amount: 12, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-subway-us', name: '🚇 Subway Pass', amount: 2.9, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-uber-us', name: '🚗 Quick Ride', amount: 18, category: 'Travel & Transit', icon: 'Car' },
    { id: 'preset-groceries-us', name: '🍎 Groceries', amount: 35, category: 'Shopping', icon: 'ShoppingBag' },
  ],
  EUR: [
    { id: 'preset-espresso-eu', name: '☕ Espresso', amount: 2.2, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-croissant-eu', name: '🥐 Croissant', amount: 2.8, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-metro-eu', name: '🚇 Metro Ticket', amount: 2.1, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-lunch-eu', name: '🥗 Bistro Lunch', amount: 14, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-groceries-eu', name: '🥖 Market Items', amount: 25, category: 'Shopping', icon: 'ShoppingBag' },
  ],
  GBP: [
    { id: 'preset-tea-uk', name: '☕ Flat White', amount: 3.8, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-mealdeal-uk', name: '🥪 Meal Deal', amount: 4.5, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-tube-uk', name: '🚇 Underground', amount: 2.8, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-pub-uk', name: '🍺 Pub Drink', amount: 6.5, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-groceries-uk', name: '🛒 Groceries', amount: 28, category: 'Shopping', icon: 'ShoppingBag' },
  ],
  AED: [
    { id: 'preset-karak-ae', name: '☕ Karak Tea', amount: 2, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-shawarma-ae', name: '🌯 Shawarma', amount: 12, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-metro-ae', name: '🚇 Nol Card', amount: 6, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-coffee-ae', name: '🥤 Speciality Coffee', amount: 24, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-groceries-ae', name: '🛒 Supermarket', amount: 80, category: 'Shopping', icon: 'ShoppingBag' },
  ],
  SGD: [
    { id: 'preset-kopi-sg', name: '☕ Kopi O', amount: 1.8, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-hawker-sg', name: '🍜 Chicken Rice', amount: 5.5, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-mrt-sg', name: '🚇 MRT Fare', amount: 2.0, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-bbt-sg', name: '🧋 Bubble Tea', amount: 4.8, category: 'Food & Dining', icon: 'Coffee' },
  ],
  JPY: [
    { id: 'preset-coffee-jp', name: '☕ Conbini Coffee', amount: 150, category: 'Food & Dining', icon: 'Coffee' },
    { id: 'preset-onigiri-jp', name: '🍙 2x Onigiri', amount: 320, category: 'Food & Dining', icon: 'UtensilsCrossed' },
    { id: 'preset-train-jp', name: '🚃 Suica Metro', amount: 240, category: 'Travel & Transit', icon: 'Bus' },
    { id: 'preset-ramen-jp', name: '🍜 Tonkotsu Ramen', amount: 950, category: 'Food & Dining', icon: 'UtensilsCrossed' },
  ],
};

const DEFAULT_BUDGETS: Record<string, number> = {
  INR: 25000,
  USD: 2500,
  EUR: 2200,
  GBP: 2000,
  AED: 7000,
  SGD: 3000,
  JPY: 250000,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Currency
  const [selectedCurrency, setSelectedCurrency] = useState('INR');

  // Step 2: Budget & PIN
  const [monthlyBudget, setMonthlyBudget] = useState(25000);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enablePin, setEnablePin] = useState(false);
  const [pinError, setPinError] = useState('');

  // Step 3: Presets
  const [customPresets, setCustomPresets] = useState<QuickSpendPreset[]>(REGIONAL_PRESETS.INR);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleSelectCurrency = (code: string) => {
    setSelectedCurrency(code);
    setMonthlyBudget(DEFAULT_BUDGETS[code] || 2500);
    setCustomPresets(REGIONAL_PRESETS[code] || REGIONAL_PRESETS.USD);
  };

  const handleStep2Next = () => {
    setPinError('');
    if (enablePin) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        setPinError('PIN must be exactly 4 numeric digits.');
        return;
      }
      if (pin !== confirmPin) {
        setPinError('Confirmation PIN does not match.');
        return;
      }
    }
    setStep(3);
  };

  const handleFinishOnboarding = async () => {
    setIsFinishing(true);

    try {
      // 1. Set active global currency
      setActiveCurrency(selectedCurrency);

      // 2. Hash PIN if enabled
      let pinHash: string | null = null;
      if (enablePin && pin.length === 4) {
        pinHash = await hashPin(pin);
        await setUnlockSession();
      }

      // 3. Update App Settings
      const existingSettings = await db.app_settings.get('global');
      await db.app_settings.put({
        id: 'global',
        currency: selectedCurrency,
        locale: SUPPORTED_CURRENCIES[selectedCurrency]?.locale || 'en-IN',
        monthlyBudget: Number(monthlyBudget) || 25000,
        fixedRecurringBills: existingSettings?.fixedRecurringBills || 8000,
        pinEnabled: Boolean(enablePin && pinHash),
        pinHash,
        autoLockMinutes: 5,
        theme: existingSettings?.theme || 'dark',
        apiKey: existingSettings?.apiKey || 'mf_user_' + Math.random().toString(36).slice(2),
        hideNotesFromParent: false,
        parentShareTokens: existingSettings?.parentShareTokens || [],
        lastActive: Date.now(),
        onboarded: true,
      });

      // 4. Seed regional quick spend presets
      await db.quick_presets.clear();
      await db.quick_presets.bulkAdd(customPresets);

      // Redirect to home dashboard
      router.push('/');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 sm:p-12 transition-colors">
      {/* Top Header */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between pb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black shadow-xs">
            <Wallet className="w-5 h-5 text-slate-950" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
            Money Flow Setup
          </span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === s
                  ? 'w-8 bg-emerald-500'
                  : step > s
                  ? 'w-2 bg-emerald-500/50'
                  : 'w-2 bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Wizard Content Card */}
      <div className="max-w-2xl mx-auto w-full my-auto">
        {/* STEP 1: Currency & Region */}
        {step === 1 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-6 animate-fade-in">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-semibold">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Step 1 of 3</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Choose Your Home Currency
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Money Flow will format all transactions, budgets, and safe-to-spend targets in your local standard.
              </p>
            </div>

            {/* Currency Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {Object.values(SUPPORTED_CURRENCIES).map((cur) => {
                const isSelected = selectedCurrency === cur.code;
                return (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => handleSelectCurrency(cur.code)}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/50 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cur.flag}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {cur.code}
                          </span>
                          <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            ({cur.symbol})
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{cur.name}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 min-h-[44px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
              >
                <span>Continue to Budget & PIN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Monthly Budget & 4-Digit Security PIN */}
        {step === 2 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-6 animate-fade-in">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Step 2 of 3</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Monthly Budget & Security PIN
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Your monthly target drives the live daily Safe-to-Spend barometer.
              </p>
            </div>

            <div className="space-y-5">
              {/* Budget Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Monthly Budget ({selectedCurrency})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-sm font-bold font-mono text-slate-400">
                    {SUPPORTED_CURRENCIES[selectedCurrency]?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    min="100"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* PIN Toggle Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Enable 4-Digit Security PIN
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Locks your vault when idle. Uses PBKDF2 / WebAuthn biometric unlock.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enablePin}
                    onChange={(e) => setEnablePin(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
                  />
                </div>

                {enablePin && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        4-Digit PIN
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        inputMode="numeric"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {pinError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{pinError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleStep2Next}
                className="px-6 py-3 min-h-[44px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20"
              >
                <span>Continue to Quick Spends</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Regional Quick-Spend Presets */}
        {step === 3 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-6 animate-fade-in">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                <span>Step 3 of 3</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                1-Tap Frequent Spends Speed Dial
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Log common daily micro-expenses in 1 second right from your dashboard.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {customPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2 shadow-xs"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {preset.name}
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {SUPPORTED_CURRENCIES[selectedCurrency]?.symbol || '$'}
                      {preset.amount}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">{preset.category}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isFinishing}
                className="px-6 py-3 min-h-[44px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <span>{isFinishing ? 'Launching Vault...' : 'Launch Dashboard'}</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="max-w-2xl mx-auto w-full text-center text-xs text-slate-400 pt-8 font-mono">
        Offline-First Dexie.js • WebAuthn Platform Security
      </div>
    </div>
  );
}
