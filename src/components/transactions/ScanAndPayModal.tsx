'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  QrCode,
  Zap,
  CheckCircle2,
  ExternalLink,
  Upload,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '@/lib/db';
import { pushToCloud } from '@/lib/sync';
import { formatINR, getActiveCurrency } from '@/lib/formatters';
import { Transaction, Category } from '@/lib/types';

interface ScanAndPayModalProps {
  categories: Category[];
  onClose: () => void;
  onLogged: () => void;
}

export interface ParsedUpiData {
  isValid: boolean;
  rawText: string;
  payeeAddress: string; // pa
  payeeName: string; // pn
  amount?: number; // am
  currency: string; // cu
  merchantCode?: string; // mc
  transactionNote?: string; // tn
}

/**
 * Parses Indian UPI QR strings (e.g. upi://pay?pa=...&pn=...)
 */
export function parseUpiQrCode(text: string): ParsedUpiData {
  const trimmed = text.trim();

  // 1. Standard UPI URI scheme
  if (trimmed.toLowerCase().startsWith('upi://pay') || trimmed.includes('pa=')) {
    try {
      const queryString = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
      const params = new URLSearchParams(queryString);

      const pa = params.get('pa') || '';
      let pn = params.get('pn') || '';
      // Decode URL encoded characters & replace pluses with spaces
      try {
        pn = decodeURIComponent(pn.replace(/\+/g, ' '));
      } catch {
        // fallback to raw
      }

      const amStr = params.get('am');
      const am = amStr ? parseFloat(amStr) : undefined;
      const cu = params.get('cu') || 'INR';
      const mc = params.get('mc') || undefined;
      const tn = params.get('tn') || undefined;

      // If pn is blank, derive a clean merchant name from the VPA
      const cleanName = pn.trim() || pa.split('@')[0].replace(/[._-]/g, ' ').toUpperCase();

      return {
        isValid: Boolean(pa),
        rawText: trimmed,
        payeeAddress: pa,
        payeeName: cleanName,
        amount: !isNaN(am as number) && (am as number) > 0 ? am : undefined,
        currency: cu,
        merchantCode: mc,
        transactionNote: tn,
      };
    } catch {
      // Fallback
    }
  }

  // 2. Direct VPA format (e.g., merchant@okhdfcbank or 9823000000@paytm)
  if (trimmed.includes('@') && !trimmed.includes(' ')) {
    const parts = trimmed.split('@');
    const cleanName = parts[0].replace(/[._-]/g, ' ').toUpperCase();
    return {
      isValid: true,
      rawText: trimmed,
      payeeAddress: trimmed,
      payeeName: cleanName,
      currency: 'INR',
    };
  }

  return {
    isValid: false,
    rawText: trimmed,
    payeeAddress: '',
    payeeName: '',
    currency: 'INR',
  };
}

export function ScanAndPayModal({
  categories,
  onClose,
  onLogged,
}: ScanAndPayModalProps) {
  const [step, setStep] = useState<'scan' | 'confirm' | 'launched'>('scan');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Parsed QR Data
  const [parsedData, setParsedData] = useState<ParsedUpiData | null>(null);

  // Confirm Form State
  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Food & Dining');
  const [merchantName, setMerchantName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLogging, setIsLogging] = useState(false);
  const [loggedAmount, setLoggedAmount] = useState<number>(0);

  // Manual Paste Fallback State
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualUpiInput, setManualUpiInput] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const curProfile = getActiveCurrency();

  // Quick micro-spend amount chips
  const quickAmounts = [10, 15, 20, 30, 50, 100, 200];

  // Quick category options with friendly micro-spend labels
  const quickCategories = [
    { name: 'Food & Dining', label: 'Chai & Snacks', icon: UtensilsCrossed },
    { name: 'Travel & Transit', label: 'Auto & Transit', icon: Car },
    { name: 'Shopping', label: 'Groceries / Kirana', icon: ShoppingBag },
    { name: 'Transfers', label: 'Quick Transfer', icon: Sparkles },
  ];

  // Step 1: Start Camera on mount
  useEffect(() => {
    let isMounted = true;
    const scannerRegionId = 'upi-camera-scanner-view';

    async function startScanner() {
      try {
        setIsInitializing(true);
        setCameraError(null);

        // Check if element exists in DOM
        const element = document.getElementById(scannerRegionId);
        if (!element) return;

        const scanner = new Html5Qrcode(scannerRegionId);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleQrDetected(decodedText);
            }
          },
          () => {
            // Frame scanned with no QR code — quiet ignore
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Camera permission denied or camera not available';
          setCameraError(msg);
          setIsInitializing(false);
        }
      }
    }

    if (step === 'scan') {
      // Delay slightly for DOM render
      const timer = setTimeout(startScanner, 200);
      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopScanner();
      };
    }
  }, [step]);

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch {
      // ignore cleanup errors
    }
  };

  const handleQrDetected = async (rawText: string) => {
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }

    await stopScanner();
    const parsed = parseUpiQrCode(rawText);

    if (parsed.isValid) {
      setParsedData(parsed);
      setMerchantName(parsed.payeeName || 'Merchant');
      if (parsed.amount) {
        setAmount(parsed.amount.toString());
      } else {
        setAmount('');
      }
      setStep('confirm');
    } else {
      alert(`Scanned code is not a recognized UPI payment QR.\n\nRaw: ${rawText.slice(0, 80)}...`);
      // Restart scanner
      setStep('scan');
    }
  };

  // Gallery image file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsInitializing(true);
      await stopScanner();

      const scanner = new Html5Qrcode('upi-camera-scanner-view');
      html5QrCodeRef.current = scanner;

      const result = await scanner.scanFileV2(file);
      if (result?.decodedText) {
        handleQrDetected(result.decodedText);
      } else {
        alert('Could not find a valid UPI QR code in this image.');
      }
    } catch {
      alert('Could not scan image file. Please point camera or enter UPI ID manually.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Manual UPI ID submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUpiInput.trim()) return;
    handleQrDetected(manualUpiInput.trim());
  };

  // Step 2: Log Expense to Money Flow and Launch UPI App
  const handleLogAndLaunchUPI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!parsedData?.payeeAddress) {
      alert('Invalid merchant UPI address.');
      return;
    }

    setIsLogging(true);
    setLoggedAmount(parsedAmt);

    try {
      const now = Date.now();
      const newTxnId = `txn-upi-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanMerchant = merchantName.trim() || parsedData.payeeName || 'UPI Merchant';

      // 1. Add transaction to IndexedDB
      const newTxn: Transaction = {
        id: newTxnId,
        amount: parsedAmt,
        type: 'expense',
        category: selectedCategory,
        merchant: cleanMerchant,
        rawMerchant: `UPI/${cleanMerchant}/${parsedData.payeeAddress}`,
        timestamp: now,
        source: 'manual',
        bankOrApp: 'Scan & Pay',
        notes: notes.trim() || `Instant UPI Scan: ${parsedData.payeeAddress}`,
        isCategorized: true,
        createdAt: now,
        updatedAt: now,
      };

      await db.transactions.add(newTxn);

      // 2. Background sync to cloud
      pushToCloud().catch(() => {});

      // 3. Haptic feedback confirmation
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }

      // 4. Construct Native UPI Deep Link
      // Standard UPI intent: upi://pay?pa=...&pn=...&am=...&cu=INR
      const upiUrl = `upi://pay?pa=${encodeURIComponent(parsedData.payeeAddress)}&pn=${encodeURIComponent(
        cleanMerchant
      )}&am=${parsedAmt}&cu=INR`;

      // 5. Fire native intent (launches GPay / PhonePe / Paytm / BHIM app chooser on Android)
      window.location.href = upiUrl;

      // 6. Transition to launched confirmation state
      setStep('launched');
      onLogged();
    } catch (err) {
      console.error('Failed to log Scan & Pay transaction:', err);
      alert('Could not save expense locally. Please try again.');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 dark:bg-black/90 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col shadow-2xl overflow-hidden animate-slide-up max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle on Mobile */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Scan & Pay UPI
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800/80 shrink-0">
                  Zero Friction
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Logs expense before launching Google Pay / PhonePe
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 min-w-0">
          {/* STEP 1: SCANNER VIEW */}
          {step === 'scan' && (
            <div className="space-y-4">
              {/* QR Scanner Container */}
              <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-emerald-500/40 shadow-inner flex flex-col items-center justify-center">
                {/* HTML5 QR Container */}
                <div id="upi-camera-scanner-view" className="w-full h-full" />

                {/* Camera Viewfinder Overlay */}
                {!cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-48 h-48 border-2 border-dashed border-emerald-400/80 rounded-2xl relative shadow-lg">
                      {/* Target Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                      {/* Scanning laser beam animation */}
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-pulse" />
                    </div>
                    <span className="text-[11px] font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full mt-3 backdrop-blur-xs">
                      Align UPI QR inside frame
                    </span>
                  </div>
                )}

                {/* Camera Permission / Error Fallback */}
                {cameraError && (
                  <div className="p-4 text-center space-y-2 z-10 text-white">
                    <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-200">Camera Access Blocked</p>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Please allow camera permission in browser settings, or upload a QR image from your gallery.
                    </p>
                  </div>
                )}

                {/* Loading indicator */}
                {isInitializing && !cameraError && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-2 text-white">
                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                    <span className="text-xs font-medium">Starting camera...</span>
                  </div>
                )}
              </div>

              {/* Alternative Input Options: Upload QR Image or Manual Paste */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR Screenshot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualPaste(!showManualPaste)}
                  className="px-3 py-2 min-h-[38px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Manual UPI ID</span>
                </button>
              </div>

              {/* Manual UPI Paste Form */}
              {showManualPaste && (
                <form onSubmit={handleManualSubmit} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 animate-fade-in">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Paste Merchant UPI ID or URI:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. sharma.tea@paytm or upi://pay?pa=..."
                      value={manualUpiInput}
                      onChange={(e) => setManualUpiInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STEP 2: CONFIRM AMOUNT & CATEGORY */}
          {step === 'confirm' && parsedData && (
            <form onSubmit={handleLogAndLaunchUPI} className="space-y-4">
              {/* Merchant Details Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block truncate">
                    Verified Merchant:
                  </span>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white bg-transparent border-none p-0 focus:outline-none w-full truncate"
                    required
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    UPI: {parsedData.payeeAddress}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              {/* Amount Input with Currency Symbol */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Amount to Pay & Log ({curProfile.symbol}):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {curProfile.symbol}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    autoFocus
                    placeholder="20"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border-2 border-emerald-500/60 dark:border-emerald-500/60 text-2xl font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 tabular-nums shadow-xs"
                    required
                  />
                </div>

                {/* Quick Micro-Spend Amount Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(q.toString())}
                      className={`px-2.5 py-1 min-h-[32px] rounded-xl text-xs font-mono font-bold transition-all shrink-0 ${
                        amount === q.toString()
                          ? 'bg-emerald-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      ₹{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Pills */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Category:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {quickCategories.map((c) => {
                    const Icon = c.icon;
                    const isSelected = selectedCategory === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedCategory(c.name)}
                        className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate">{c.label}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{c.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary Action: Log & Launch UPI App */}
              <button
                type="submit"
                disabled={isLogging}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>{isLogging ? 'Logging Expense...' : 'Log & Open UPI App 🚀'}</span>
              </button>
            </form>
          )}

          {/* STEP 3: LAUNCHED CONFIRMATION */}
          {step === 'launched' && parsedData && (
            <div className="p-4 text-center space-y-4 animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {formatINR(loggedAmount)} Logged Successfully!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Recorded under <strong>{selectedCategory}</strong> for <em>{merchantName}</em>.
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  Launching your native UPI app...
                </p>
              </div>

              {/* Direct UPI App Fallbacks */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Didn&apos;t open automatically? Choose your app:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`upi://pay?pa=${encodeURIComponent(parsedData.payeeAddress)}&pn=${encodeURIComponent(
                      merchantName
                    )}&am=${loggedAmount}&cu=INR`}
                    className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <span>Google Pay</span>
                  </a>
                  <a
                    href={`upi://pay?pa=${encodeURIComponent(parsedData.payeeAddress)}&pn=${encodeURIComponent(
                      merchantName
                    )}&am=${loggedAmount}&cu=INR`}
                    className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
                    <span>PhonePe / Paytm</span>
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
