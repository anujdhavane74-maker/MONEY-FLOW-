'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Dice5,
  Check,
  QrCode,
  MessageCircle,
  Sparkles,
  Camera,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import { IOU } from '@/lib/types';
import { formatINR, formatISTDate } from '@/lib/formatters';
import {
  RoastPersonaId,
  ROAST_PERSONAS,
  SARCASTIC_ROAST_LINES,
  SarcasticCard,
  CardItemBreakdown,
} from './SarcasticCardTemplates';

interface SarcasticCardStudioModalProps {
  friendName: string;
  friendIOUs: IOU[];
  selectedIouId?: string;
  defaultUpiId?: string;
  onClose: () => void;
  onSaveUpiId?: (upi: string) => void;
}

export function SarcasticCardStudioModal({
  friendName,
  friendIOUs,
  selectedIouId,
  defaultUpiId = '',
  onClose,
  onSaveUpiId,
}: SarcasticCardStudioModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Studio State
  const [templateId, setTemplateId] = useState<RoastPersonaId>('amnesia');
  const [useConsolidated, setUseConsolidated] = useState<boolean>(
    friendIOUs.length > 1 && !selectedIouId
  );
  const [selectedSingleId, setSelectedSingleId] = useState<string>(
    selectedIouId || friendIOUs[0]?.id || ''
  );

  // Roast Customization State
  const [roastIndex, setRoastIndex] = useState<number>(0);
  const [customNote, setCustomNote] = useState<string>(SARCASTIC_ROAST_LINES[0]);

  // UPI Toggle State
  const [showUpiBadge, setShowUpiBadge] = useState<boolean>(true);
  const [upiId, setUpiId] = useState<string>(() => {
    if (defaultUpiId) return defaultUpiId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mf_user_upi_id') || '';
    }
    return '';
  });

  // Action / Toast State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute items & total based on single vs consolidated
  const { totalAmount, activeItems, oldestDays } = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;

    if (useConsolidated && friendIOUs.length > 1) {
      const total = friendIOUs.reduce((sum, i) => sum + i.amount, 0);
      const items: CardItemBreakdown[] = friendIOUs.map((i) => ({
        description: i.description || 'Split Expense',
        amount: i.amount,
        dateStr: formatISTDate(i.createdAt),
      }));

      const oldestTime = Math.min(...friendIOUs.map((i) => i.createdAt));
      const days = Math.max(1, Math.floor((now - oldestTime) / dayMs));

      return { totalAmount: total, activeItems: items, oldestDays: days };
    }

    // Single IOU mode
    const target = friendIOUs.find((i) => i.id === selectedSingleId) || friendIOUs[0];
    const amount = target ? target.amount : 0;
    const items: CardItemBreakdown[] = target
      ? [
          {
            description: target.description || 'Split Expense',
            amount: target.amount,
            dateStr: formatISTDate(target.createdAt),
          },
        ]
      : [];
    const days = target ? Math.max(1, Math.floor((now - target.createdAt) / dayMs)) : 1;

    return { totalAmount: amount, activeItems: items, oldestDays: days };
  }, [useConsolidated, friendIOUs, selectedSingleId]);

  // Shuffle roast line
  const handleShuffleRoast = () => {
    const nextIdx = (roastIndex + 1) % SARCASTIC_ROAST_LINES.length;
    setRoastIndex(nextIdx);
    setCustomNote(SARCASTIC_ROAST_LINES[nextIdx]);
  };

  // Update UPI ID & persist
  const handleUpiChange = (newUpi: string) => {
    setUpiId(newUpi);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mf_user_upi_id', newUpi);
    }
    if (onSaveUpiId) {
      onSaveUpiId(newUpi);
    }
  };

  // Generate clean sarcastic text for caption & clipboard
  const generateCaptionText = () => {
    const itemsList = activeItems.map((it) => `• ${it.description}: ${formatINR(it.amount)}`).join('\n');
    let text = `🚨 *URGENT DEBT NOTICE for ${friendName}* 🚨\n\n`;
    text += `Hey ${friendName}, your Friendship CIBIL Score is currently in critical condition!\n\n`;
    text += `💰 *Total Overdue:* ${formatINR(totalAmount)}\n`;
    text += `⏳ *Time Elapsed:* ${oldestDays} days since "Bhai shaam ko GPay karta hoon"\n\n`;
    text += `📋 *Breakdown:*\n${itemsList}\n\n`;
    text += `💬 *Note:* "${customNote}"\n\n`;
    if (showUpiBadge && upiId.trim()) {
      text += `👉 *Instant Repayment via UPI:* ${upiId.trim()}\n`;
      text += `🔗 *UPI Deep Link:* upi://pay?pa=${encodeURIComponent(upiId.trim())}&am=${totalAmount}&pn=MoneyFlow\n\n`;
    }
    text += `Please settle this tab before your case is transferred to the group chat roasting tribunal! 💸`;
    return text;
  };

  // 1. One-Tap Native Share (WhatsApp / Instagram / Stories / DMs)
  const handleNativeShare = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);

    try {
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });

      if (!blob) throw new Error('Failed to generate image blob');

      const fileName = `debt-reminder-${friendName.toLowerCase().replace(/\s+/g, '-')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // Check if Web Share API supports file sharing
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Overdue Tab for ${friendName}`,
          text: generateCaptionText(),
        });
        showToast('Shared successfully!');
      } else {
        // Fallback: Download high-DPI PNG and copy caption
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();

        await navigator.clipboard.writeText(generateCaptionText());
        showToast('Card saved! Caption copied to clipboard.');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // User didn't just cancel the share dialog
        showToast('Downloaded PNG card to your device!');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Direct WhatsApp Link
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateCaptionText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // 3. Download PNG Directly
  const handleDownloadPng = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `money-flow-roast-${friendName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      showToast('Downloaded high-res PNG card!');
    } catch (err) {
      showToast('Failed to download image.');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Copy Roast Caption
  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(generateCaptionText());
      showToast('Roast text copied to clipboard!');
    } catch (err) {
      showToast('Could not copy to clipboard.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex flex-col shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Pill */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Top Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  Sarcastic IOU Card Studio
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-300 dark:border-cyan-800/80 shrink-0">
                  Roast & Collect
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Targeting: <strong className="text-slate-800 dark:text-slate-200">{friendName}</strong> • {formatINR(totalAmount)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Close Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Studio Body: 2-Column Responsive Layout on Desktop, Scrollable Column on Mobile */}
        <div className="flex-1 overflow-y-auto min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-4 sm:p-6 items-start">
          {/* Left Column (5 cols on lg): Interactive Customizer Controls */}
          <div className="lg:col-span-5 space-y-4 min-w-0 order-2 lg:order-1">
            {/* 1. Template Switcher */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                1. Select Roast Persona
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROAST_PERSONAS.map((p) => {
                  const isSelected = templateId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTemplateId(p.id)}
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-500 dark:border-cyan-500/80 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {p.badge}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Debt Scope (Single Bill vs Consolidated Dossier) */}
            {friendIOUs.length > 1 && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  2. Debt Scope ({friendIOUs.length} Unpaid Bills)
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUseConsolidated(true)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                      useConsolidated
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All {friendIOUs.length} Bills ({formatINR(friendIOUs.reduce((s, i) => s + i.amount, 0))})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseConsolidated(false)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                      !useConsolidated
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Single Specific Bill
                  </button>
                </div>

                {!useConsolidated && (
                  <select
                    value={selectedSingleId}
                    onChange={(e) => setSelectedSingleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  >
                    {friendIOUs.map((iou) => (
                      <option key={iou.id} value={iou.id}>
                        {iou.description} — {formatINR(iou.amount)} ({formatISTDate(iou.createdAt)})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. Roast One-Liner Editor + Shuffle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  3. Roast One-Liner
                </label>
                <button
                  type="button"
                  onClick={handleShuffleRoast}
                  className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Dice5 className="w-3.5 h-3.5 animate-spin-once" />
                  <span>Shuffle Roast 🎲</span>
                </button>
              </div>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={3}
                placeholder="Type a witty sarcastic reminder..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
              />
            </div>

            {/* 4. UPI ID Badge Toggle */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Embed My UPI ID onto Card
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showUpiBadge}
                  onChange={(e) => setShowUpiBadge(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-600 cursor-pointer"
                />
              </div>

              {showUpiBadge && (
                <input
                  type="text"
                  placeholder="e.g. yourname@okhdfcbank or 9823000000@paytm"
                  value={upiId}
                  onChange={(e) => handleUpiChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              )}
            </div>
          </div>

          {/* Right Column (7 cols on lg): Live Preview Area */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center min-w-0 order-1 lg:order-2">
            <div className="w-full flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-500" />
                Live Card Studio Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                High-DPI Retina Ready
              </span>
            </div>

            {/* Card Render Container with Ref */}
            <div className="w-full flex items-center justify-center p-2 sm:p-4 rounded-3xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-inner overflow-x-hidden">
              <div ref={cardRef} className="w-full max-w-[420px] transition-transform">
                <SarcasticCard
                  templateId={templateId}
                  friendName={friendName}
                  amount={totalAmount}
                  items={activeItems}
                  daysOwed={oldestDays}
                  customRoastNote={customNote}
                  showUpiBadge={showUpiBadge}
                  upiId={upiId}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Bar (Fixed, Touch-Friendly on Mobile) */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Quick Toast Banner */}
          {toastMessage && (
            <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 animate-fade-in shadow-md">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Secondary Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyCaption}
              className="px-3 py-2 min-h-[40px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Copy sarcastic message to clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy Roast</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isExporting}
              className="px-3 py-2 min-h-[40px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Download card image as PNG"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Save PNG</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-2 min-h-[40px] rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Open WhatsApp with pre-filled message"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Direct</span>
            </button>
          </div>

          {/* Primary Action Button: Native Image Share */}
          <button
            type="button"
            onClick={handleNativeShare}
            disabled={isExporting}
            className="flex-1 sm:flex-initial px-5 py-2.5 min-h-[42px] rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>{isExporting ? 'Generating Card...' : 'Share Card (Instagram / WhatsApp)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
