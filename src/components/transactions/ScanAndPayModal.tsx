'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Flashlight,
  FlashlightOff,
  Upload,
  Keyboard,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Users,
  ChevronRight,
  ArrowRight,
  Delete,
  ExternalLink,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { db } from '@/lib/db';
import { pushToCloud } from '@/lib/sync';
import { formatINR, getActiveCurrency } from '@/lib/formatters';
import { Transaction, Category, IOU } from '@/lib/types';
import {
  parseUpiQrPayload,
  buildUpiDeepLink,
  ParsedUpiPayload,
} from '@/lib/upiParser';

interface ScanAndPayModalProps {
  categories: Category[];
  dailySafeLimit?: number;
  spentToday?: number;
  onClose: () => void;
  onLogged: () => void;
}

export function ScanAndPayModal({
  categories,
  dailySafeLimit = 500,
  spentToday = 0,
  onClose,
  onLogged,
}: ScanAndPayModalProps) {
  // Screen flow: 'scanner' -> 'sheet' -> 'post_launch'
  const [screen, setScreen] = useState<'scanner' | 'sheet' | 'post_launch'>('scanner');

  // Scanner State
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualVpa, setManualVpa] = useState('');

  // Payment Sheet State
  const [parsedUpi, setParsedUpi] = useState<ParsedUpiPayload | null>(null);
  const [amountStr, setAmountStr] = useState<string>('');
  const [isFixedAmount, setIsFixedAmount] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Food & Dining');
  const [paymentNote, setPaymentNote] = useState<string>('');

  // Split Bill with Friend state
  const [enableSplit, setEnableSplit] = useState(false);
  const [splitFriendName, setSplitFriendName] = useState('');
  const [splitFriendAmount, setSplitFriendAmount] = useState('');

  // Post-launch Confirmation & Rollback State
  const [loggedTxnId, setLoggedTxnId] = useState<string | null>(null);
  const [loggedIouId, setLoggedIouId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const curProfile = getActiveCurrency();

  // Standard category pill options
  const categoryPills = useMemo(() => {
    return [
      { name: 'Food & Dining', emoji: '☕' },
      { name: 'Travel & Transit', emoji: '🛺' },
      { name: 'Shopping', emoji: '🛍️' },
      { name: 'Rent & Bills', emoji: '⚡' },
      { name: 'Stationery & Education', emoji: '📚' },
      { name: 'Subscriptions & Gaming', emoji: '🎮' },
    ];
  }, []);

  // Quick Amount Add Chips
  const quickAddChips = [10, 20, 50, 100];

  // 1. Initialize Camera Scanner
  useEffect(() => {
    let isMounted = true;
    const scannerId = 'fampay-upi-scanner-view';

    async function startScanner() {
      try {
        setIsInitializing(true);
        setCameraError(null);

        const el = document.getElementById(scannerId);
        if (!el) return;

        const scanner = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              handleQrLocked(decodedText);
            }
          },
          () => {
            // quiet non-match frame
          }
        );

        if (isMounted) {
          setIsInitializing(false);

          // Check torch capability
          try {
            const capabilities = scanner.getRunningTrackCapabilities() as any;
            if (capabilities && 'torch' in capabilities) {
              setHasTorchSupport(true);
            }
          } catch {
            // Torch not supported
          }
        }
      } catch (err) {
        if (isMounted) {
          const msg =
            err instanceof Error ? err.message : 'Camera permission denied or camera not available';
          setCameraError(msg);
          setIsInitializing(false);
        }
      }
    }

    if (screen === 'scanner') {
      const timer = setTimeout(startScanner, 150);
      return () => {
        isMounted = false;
        clearTimeout(timer);
        stopScanner();
      };
    }
  }, [screen]);

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch {
      // quiet cleanup
    }
  };

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorchSupport) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch {
      // ignore torch fail
    }
  };

  // QR Decoded Handler
  const handleQrLocked = async (rawQrString: string) => {
    // Haptic buzz on lock
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 15, 20]);
    }

    await stopScanner();
    const parsed = parseUpiQrPayload(rawQrString);

    if (!parsed.isValid) {
      setErrorMessage(parsed.errorMessage || 'Not a valid UPI payment QR');
      setTimeout(() => setErrorMessage(null), 3000);
      setScreen('scanner');
      return;
    }

    setParsedUpi(parsed);
    setSelectedCategory(parsed.suggestedCategory || 'Food & Dining');
    setPaymentNote(parsed.transactionNote || '');

    if (parsed.amount && parsed.amount > 0) {
      setAmountStr(parsed.amount.toString());
      setIsFixedAmount(true);
    } else {
      setAmountStr('');
      setIsFixedAmount(false);
    }

    setScreen('sheet');
  };

  // Gallery image file decode
  const handleScanFromGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsInitializing(true);
      await stopScanner();

      const scanner = new Html5Qrcode('fampay-upi-scanner-view');
      html5QrCodeRef.current = scanner;

      const result = await scanner.scanFileV2(file);
      if (result?.decodedText) {
        handleQrLocked(result.decodedText);
      } else {
        alert('Could not find a valid UPI QR code in this image.');
      }
    } catch {
      alert('Could not read image file. Please point camera or enter UPI ID manually.');
    } finally {
      setIsInitializing(false);
    }
  };

  // Manual VPA submission
  const handleManualVpaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVpa.trim()) return;
    handleQrLocked(manualVpa.trim());
  };

  // Numpad key input
  const handleNumpadKey = (key: string) => {
    if (isFixedAmount) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(15);
    }

    if (key === 'backspace') {
      setAmountStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
      return;
    }

    if (key === '.') {
      if (amountStr.includes('.')) return;
      setAmountStr((prev) => (prev === '' ? '0.' : prev + '.'));
      return;
    }

    // Numbers
    setAmountStr((prev) => {
      if (prev === '0') return key;
      if (prev.length >= 7) return prev; // max 99,99,999
      return prev + key;
    });
  };

  // Quick amount chip add
  const handleQuickAdd = (chipAmt: number) => {
    if (isFixedAmount) return;
    const current = parseFloat(amountStr) || 0;
    const next = current + chipAmt;
    setAmountStr(next.toString());
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  const parsedAmount = parseFloat(amountStr) || 0;

  // Safe-to-Spend Real-Time Comparison
  const safeSpendComparison = useMemo(() => {
    const remainingToday = dailySafeLimit - spentToday;
    const afterSpend = remainingToday - parsedAmount;
    const isOver = afterSpend < 0;

    return {
      remainingToday,
      afterSpend,
      isOver,
    };
  }, [dailySafeLimit, spentToday, parsedAmount]);

  // Execute Payment & Launch Native UPI App
  const handleExecutePayment = async () => {
    if (parsedAmount <= 0) {
      alert('Please enter an amount to pay.');
      return;
    }
    if (!parsedUpi?.payeeAddress) {
      alert('Invalid merchant address.');
      return;
    }

    setIsProcessing(true);

    try {
      const now = Date.now();
      const txnId = `txn-scanpay-${now}-${Math.random().toString(36).slice(2, 6)}`;
      let iouId: string | null = null;

      // Calculate personal share if friend split enabled
      const splitAmt = enableSplit ? parseFloat(splitFriendAmount) || 0 : 0;
      const myShare = enableSplit && splitAmt > 0 ? Math.max(0, parsedAmount - splitAmt) : parsedAmount;

      // 1. Save personal expense to IndexedDB
      const newTxn: Transaction = {
        id: txnId,
        amount: myShare,
        type: 'expense',
        category: selectedCategory,
        merchant: parsedUpi.payeeName,
        rawMerchant: `UPI/${parsedUpi.payeeName}/${parsedUpi.payeeAddress}`,
        timestamp: now,
        source: 'manual',
        bankOrApp: 'Scan & Pay UPI',
        notes: paymentNote.trim() || `Scan & Pay to ${parsedUpi.payeeAddress}`,
        isCategorized: true,
        isSplit: enableSplit && splitAmt > 0,
        splitTotalAmount: parsedAmount,
        myShareAmount: myShare,
        createdAt: now,
        updatedAt: now,
      };
      await db.transactions.add(newTxn);

      // 2. If split enabled, save friend IOU to IndexedDB
      if (enableSplit && splitAmt > 0 && splitFriendName.trim()) {
        iouId = `iou-${now}-${Math.random().toString(36).slice(2, 6)}`;
        const newIou: IOU = {
          id: iouId,
          transactionId: txnId,
          personName: splitFriendName.trim(),
          amount: splitAmt,
          status: 'pending',
          description: `Split: ${parsedUpi.payeeName} (${paymentNote.trim() || 'UPI Bill'})`,
          createdAt: now,
        };
        await db.ious.add(newIou);
      }

      setLoggedTxnId(txnId);
      setLoggedIouId(iouId);

      // 3. Trigger cloud sync
      pushToCloud().catch(() => {});

      // 4. Haptic vibration
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }

      // 5. Build compliant NPCI deep-link
      const upiUrl = buildUpiDeepLink({
        payeeAddress: parsedUpi.payeeAddress,
        payeeName: parsedUpi.payeeName,
        amount: parsedAmount,
        note: paymentNote.trim() || `Paid to ${parsedUpi.payeeName}`,
      });

      // 6. Launch native UPI app intent on mobile
      window.location.href = upiUrl;

      // 7. Transition to post-launch confirmation screen
      setScreen('post_launch');
      onLogged();
    } catch (err) {
      console.error('Failed to log scan & pay transaction:', err);
      alert('Could not record expense. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Rollback if user cancelled or bank transaction failed
  const handleRollbackPayment = async () => {
    if (!loggedTxnId) return;
    if (confirm('Did the UPI payment fail or get cancelled? This will roll back the logged expense from your records.')) {
      await db.transactions.delete(loggedTxnId);
      if (loggedIouId) {
        await db.ious.delete(loggedIouId);
      }
      pushToCloud().catch(() => {});
      onLogged();
      onClose();
    }
  };

  // Confirm payment succeeded
  const handleConfirmSuccess = () => {
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore confetti errors
    }
    setTimeout(onClose, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-[#0A0E1A] text-white flex flex-col sm:rounded-3xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Error Toast */}
        {errorMessage && (
          <div className="absolute top-4 inset-x-4 z-50 py-2.5 px-4 rounded-2xl bg-rose-600/90 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-slide-down">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* =========================================================================
            SCREEN 1: FULL-SCREEN SCANNER VIEW
           ========================================================================= */}
        {screen === 'scanner' && (
          <div className="flex-1 flex flex-col justify-between relative bg-black overflow-hidden">
            {/* Camera Viewport Target (HTML5 QR Mount) */}
            <div className="absolute inset-0 z-0">
              <div id="fampay-upi-scanner-view" className="w-full h-full" />
            </div>

            {/* Floating Glassmorphic Top Bar */}
            <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 shadow-sm"
                aria-label="Close Scanner"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="px-3.5 py-1.5 rounded-full bg-black/50 border border-white/15 backdrop-blur-md flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black tracking-wide text-white uppercase">
                  Scan Any UPI QR
                </span>
              </div>

              {/* Torch Toggle */}
              <button
                type="button"
                onClick={handleToggleTorch}
                disabled={!hasTorchSupport}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-md disabled:opacity-30'
                }`}
                title={hasTorchSupport ? 'Toggle Flashlight' : 'Torch not supported on this device'}
                aria-label="Toggle Torch"
              >
                {isTorchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
              </button>
            </div>

            {/* Glowing Reticle & Laser Scanner in Center */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none p-4">
              {!cameraError && (
                <div className="relative w-64 h-64 max-w-[70vw] aspect-square rounded-3xl border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.15)] flex items-center justify-center">
                  {/* Four Corner Accents (FamPay Signature Emerald/Cyan glow) */}
                  <div className="absolute -top-1.5 -left-1.5 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl shadow-[0_0_12px_#34d399]" />
                  <div className="absolute -top-1.5 -right-1.5 w-7 h-7 border-t-4 border-r-4 border-cyan-400 rounded-tr-2xl shadow-[0_0_12px_#22d3ee]" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 border-b-4 border-l-4 border-cyan-400 rounded-bl-2xl shadow-[0_0_12px_#22d3ee]" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl shadow-[0_0_12px_#34d399]" />

                  {/* Pulsing Animated Laser Line */}
                  <div className="absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-pulse" />
                </div>
              )}

              {/* Camera Error / Permission Fallback */}
              {cameraError && (
                <div className="p-5 max-w-xs text-center rounded-3xl bg-slate-900/90 border border-slate-800 pointer-events-auto space-y-2">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-bold text-white">Camera Permission Needed</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Allow camera access to scan physical QR codes, or upload a QR screenshot from your gallery below.
                  </p>
                </div>
              )}

              {isInitializing && !cameraError && (
                <div className="text-center text-slate-400 text-xs mt-3 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Activating camera...</span>
                </div>
              )}
            </div>

            {/* Floating Bottom Action Dock */}
            <div className="relative z-10 p-4 sm:p-5 pb-6 bg-gradient-to-t from-black via-black/90 to-transparent space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleScanFromGallery}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>From Gallery</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Keyboard className="w-4 h-4 text-cyan-400" />
                  <span>Enter UPI ID</span>
                </button>
              </div>

              {/* Manual UPI Input Dropdown */}
              {showManualInput && (
                <form
                  onSubmit={handleManualVpaSubmit}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 flex gap-2 animate-slide-up"
                >
                  <input
                    type="text"
                    placeholder="e.g. sharma.tea@paytm or 9823000000@ybl"
                    value={manualVpa}
                    onChange={(e) => setManualVpa(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                  >
                    Pay
                  </button>
                </form>
              )}

              {/* NPCI Trust Strip */}
              <div className="text-center pt-1">
                <p className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                  Supported by GPay • PhonePe • Paytm • BHIM • Cred
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 2: FAMPAY-STYLE PAYMENT & BUDGET SHEET
           ========================================================================= */}
        {screen === 'sheet' && parsedUpi && (
          <div className="flex-1 flex flex-col justify-between overflow-y-auto min-w-0">
            {/* Sheet Top Navigation */}
            <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setScreen('scanner')}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>← Re-scan</span>
              </button>

              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Instant UPI Payment
              </span>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* 1. Merchant Header Card */}
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Monogram Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 shadow-md shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-[#0A0E1A] flex items-center justify-center font-black text-emerald-400 text-lg">
                      {parsedUpi.payeeName.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-extrabold text-white truncate">
                        {parsedUpi.payeeName}
                      </h3>
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate">
                      {parsedUpi.payeeAddress}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Category:
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {selectedCategory}
                  </span>
                </div>
              </div>

              {/* 1-Tap Category Switcher Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categoryPills.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 shadow-xs'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 2. Hero Amount Input with Blinking Cursor */}
              <div className="py-2 text-center space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {isFixedAmount ? 'Pre-filled by Merchant' : 'Enter Amount to Pay'}
                </span>

                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white flex items-center justify-center">
                  <span className="text-emerald-400 mr-1">{curProfile.symbol}</span>
                  <span>{amountStr || '0'}</span>
                  {!isFixedAmount && (
                    <span className="w-1 h-9 bg-emerald-400 ml-1 rounded-full animate-pulse" />
                  )}
                </div>

                {/* Live Safe-To-Spend Impact Pill */}
                <div className="pt-1 flex items-center justify-center">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      safeSpendComparison.isOver
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                        : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {safeSpendComparison.isOver
                        ? `Overshoots today by ${formatINR(Math.abs(safeSpendComparison.afterSpend))}`
                        : `Safe Spend: ${formatINR(safeSpendComparison.afterSpend)} left today`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Add Chips (If not fixed amount) */}
              {!isFixedAmount && (
                <div className="grid grid-cols-4 gap-2">
                  {quickAddChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuickAdd(chip)}
                      className="py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono font-bold text-slate-300 hover:text-white transition-colors"
                    >
                      +{chip}
                    </button>
                  ))}
                </div>
              )}

              {/* 3. Optional Split Bill with Friends */}
              <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">Split this bill with a friend?</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableSplit}
                    onChange={(e) => setEnableSplit(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-600 cursor-pointer"
                  />
                </div>

                {enableSplit && (
                  <div className="grid grid-cols-2 gap-2 pt-1 animate-slide-down">
                    <input
                      type="text"
                      placeholder="Friend's Name (e.g. Rahul)"
                      value={splitFriendName}
                      onChange={(e) => setSplitFriendName(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="number"
                      placeholder="Their share (₹)"
                      value={splitFriendAmount}
                      onChange={(e) => setSplitFriendAmount(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* 4. Built-in 3x4 Fintech Numpad */}
              {!isFixedAmount && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleNumpadKey(digit)}
                      className="h-11 rounded-2xl bg-slate-900/90 border border-slate-800 text-lg font-bold font-mono text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleNumpadKey('backspace')}
                    className="h-11 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-rose-400 flex items-center justify-center hover:bg-rose-950/40 active:scale-95 transition-all"
                    aria-label="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Primary CTA */}
            <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950">
              <button
                type="button"
                onClick={handleExecutePayment}
                disabled={parsedAmount <= 0 || isProcessing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/25 transition-all disabled:opacity-40"
              >
                <span>{isProcessing ? 'Logging...' : `Log & Pay ${formatINR(parsedAmount)} →`}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            SCREEN 3: POST-LAUNCH VERIFICATION & ROLLBACK
           ========================================================================= */}
        {screen === 'post_launch' && parsedUpi && (
          <div className="p-6 text-center space-y-5 flex-1 flex flex-col justify-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Payment Launched!</h2>
              <p className="text-xs text-slate-400">
                Logged <strong>{formatINR(parsedAmount)}</strong> under <em>{selectedCategory}</em> for <strong>{parsedUpi.payeeName}</strong>.
              </p>
              <p className="text-xs text-emerald-400 font-semibold pt-1">
                Your native UPI app (GPay / PhonePe) was triggered.
              </p>
            </div>

            {/* Verification Prompt Card */}
            <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 text-left">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
                Did your payment complete successfully?
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleConfirmSuccess}
                  className="py-3 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yes, Succeeded ✨</span>
                </button>

                <button
                  type="button"
                  onClick={handleRollbackPayment}
                  className="py-3 px-3 rounded-2xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/60 text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Failed / Cancelled</span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={buildUpiDeepLink({
                  payeeAddress: parsedUpi.payeeAddress,
                  payeeName: parsedUpi.payeeName,
                  amount: parsedAmount,
                  note: paymentNote,
                })}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Re-open UPI app if it didn&apos;t open automatically</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
