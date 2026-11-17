'use client';

import React from 'react';
import {
  AlertTriangle,
  Stethoscope,
  Flame,
  Tv,
  CheckCircle,
  QrCode,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

export type RoastPersonaId = 'amnesia' | 'bank_notice' | 'receipt' | 'breaking_news';

export interface CardItemBreakdown {
  description: string;
  amount: number;
  dateStr?: string;
}

export interface SarcasticCardProps {
  friendName: string;
  amount: number;
  items: CardItemBreakdown[];
  daysOwed: number;
  customRoastNote: string;
  showUpiBadge: boolean;
  upiId?: string;
}

export const ROAST_PERSONAS: {
  id: RoastPersonaId;
  name: string;
  badge: string;
  tagline: string;
}[] = [
  {
    id: 'amnesia',
    name: 'The Amnesia Clinic',
    badge: '🩺 Medical Rx',
    tagline: 'Prescription for acute selective memory loss',
  },
  {
    id: 'bank_notice',
    name: 'Bank of Friendship',
    badge: '🚨 Final Notice',
    tagline: 'Formal legal default & CIBIL score audit',
  },
  {
    id: 'receipt',
    name: 'Meme Receipt',
    badge: '🧾 Thermal Bill',
    tagline: 'Itemized split with emotional distress tax',
  },
  {
    id: 'breaking_news',
    name: 'Breaking News',
    badge: '📺 TV Chyron',
    tagline: 'Live prime-time scandal broadcast',
  },
];

export const SARCASTIC_ROAST_LINES = [
  "GPay is completely free to download on the Play Store, bro.",
  "My bank account misses you more than your ex ever did.",
  "You have money for matcha latte and weekend plans, but for this your phone enters airplane mode?",
  "Friendship is priceless. This bill, however, is very much not.",
  "Even the Reserve Bank of India is concerned about your liquidity crisis.",
  "Are you saving this money for our joint retirement home?",
  "I checked with NASA, they still haven't found your payment confirmation.",
  "Breaking news: Inflation is up 6%, but your payment speed is down 100%.",
  "If I had a rupee for every time you said 'Bhai ghar jaake bhejta hoon', you wouldn't owe me anything.",
  "Consider this a gentle nudge from your personal non-profit sponsor.",
  "Bro, my wallet is on life support. Don't make me bring this up in front of your parents.",
  "I am once again asking for your financial cooperation.",
  "My astrologer said good karma comes immediately after settling your UPI debts.",
  "Waiting for this payment feels like waiting for GTA 6.",
];

/**
 * 1. THE AMNESIA CLINIC (Medical Prescription Pad)
 */
export function AmnesiaClinicCard({
  friendName,
  amount,
  items,
  daysOwed,
  customRoastNote,
  showUpiBadge,
  upiId,
}: SarcasticCardProps) {
  const primaryItem = items[0]?.description || 'Shared Expense';

  return (
    <div className="w-full max-w-[420px] mx-auto rounded-3xl bg-[#FEFDF9] text-slate-900 border-2 border-emerald-800/30 p-5 sm:p-6 shadow-2xl relative overflow-hidden font-sans select-none">
      {/* Decorative prescription background watermark */}
      <div className="absolute right-3 top-3 opacity-[0.04] text-[160px] font-serif font-black select-none pointer-events-none leading-none">
        ℞
      </div>

      {/* Header */}
      <div className="border-b-2 border-emerald-900/20 pb-3.5 mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-[11px] tracking-wider uppercase">
            <Stethoscope className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Clinic of Selective Debt Amnesia</span>
          </div>
          <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-950 mt-0.5">
            CLINICAL Rx PRESCRIPTION
          </h3>
          <p className="text-[10px] text-slate-500 font-medium">
            Dept. of Acute Payment Avoidance & Ghosting Syndrome
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold border border-emerald-300">
            CASE #{daysOwed > 0 ? `${daysOwed}D` : 'URGENT'}
          </span>
          <p className="text-[9px] text-slate-400 mt-1 font-mono">CONFIDENTIAL</p>
        </div>
      </div>

      {/* Patient Vitals */}
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 mb-3.5 text-xs">
        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
            Patient Name
          </span>
          <span className="font-extrabold text-slate-900 truncate block text-sm">
            {friendName}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
            Days in Denial
          </span>
          <span className="font-extrabold text-amber-700 font-mono text-sm">
            {Math.max(1, daysOwed)} Days Overdue
          </span>
        </div>
      </div>

      {/* Medical Diagnosis */}
      <div className="space-y-2.5 text-xs mb-3.5">
        <div>
          <span className="text-[10px] font-black tracking-wider uppercase text-emerald-900 block mb-0.5">
            Diagnosis:
          </span>
          <p className="text-slate-800 leading-snug bg-white/80 p-2.5 rounded-xl border border-slate-200">
            Acute memory lapse regarding{' '}
            <strong className="text-emerald-800 font-mono">{formatINR(amount)}</strong> for{' '}
            <span className="font-semibold text-slate-950">&ldquo;{primaryItem}&rdquo;</span>.
            {items.length > 1 && ` (Consolidated over ${items.length} pending split bills).`}
          </p>
        </div>

        <div>
          <span className="text-[10px] font-black tracking-wider uppercase text-amber-900 block mb-0.5">
            Observed Symptoms:
          </span>
          <p className="text-slate-600 text-[11px] leading-relaxed italic">
            Patient was spotted fully functional, active on Instagram Stories, and buying specialty beverages, yet displays severe thumb paralysis whenever UPI is mentioned.
          </p>
        </div>

        {/* Doctor's Prescription / Custom Roast Note */}
        <div>
          <span className="text-[10px] font-black tracking-wider uppercase text-emerald-900 block mb-0.5">
            Prescribed Treatment:
          </span>
          <div className="p-3 rounded-2xl bg-emerald-700 text-white font-medium text-xs shadow-inner">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none font-serif font-black">℞</span>
              <p className="text-emerald-50 leading-snug font-medium">
                {customRoastNote || "1-Tap instant UPI transfer of the exact amount before interest compounds in acute social embarrassment."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Box & Doctor Signature */}
      <div className="pt-2 border-t border-dashed border-emerald-900/30 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            Dosage Required:
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-emerald-900 tabular-nums">
            {formatINR(amount)}
          </span>
        </div>
        <div className="text-right">
          <p className="font-serif italic font-bold text-slate-800 text-xs sm:text-sm">
            Dr. Empty Pockets, MD
          </p>
          <span className="text-[9px] text-slate-500 block">
            Specialist in Broke Friend Finances
          </span>
        </div>
      </div>

      {/* Optional UPI ID Badge */}
      {showUpiBadge && upiId && (
        <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center justify-between gap-2 bg-emerald-100/60 p-2.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <QrCode className="w-4 h-4 text-emerald-800 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-900 truncate font-mono">
              UPI: {upiId}
            </span>
          </div>
          <span className="text-[9px] uppercase font-black text-emerald-800 px-1.5 py-0.5 rounded bg-white shrink-0">
            GPay / PhonePe
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 2. BANK OF FRIENDSHIP — FINAL DEMAND NOTICE
 */
export function BankNoticeCard({
  friendName,
  amount,
  items,
  daysOwed,
  customRoastNote,
  showUpiBadge,
  upiId,
}: SarcasticCardProps) {
  const primaryItem = items[0]?.description || 'Shared Expense';

  return (
    <div className="w-full max-w-[420px] mx-auto rounded-3xl bg-[#0F172A] text-white border-2 border-red-500/40 p-5 sm:p-6 shadow-2xl relative overflow-hidden font-sans select-none">
      {/* Decorative Red Stamp */}
      <div className="absolute -right-6 top-6 rotate-12 z-10 pointer-events-none">
        <div className="px-5 py-1.5 rounded-xl border-4 border-red-500/80 bg-red-950/80 text-red-400 font-black text-xs sm:text-sm tracking-widest uppercase shadow-lg">
          OVERDUE DEBT
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-slate-700 pb-3 mb-3.5">
        <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-black uppercase tracking-widest">
          <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          <span>Friendship Reserve Bank of India</span>
        </div>
        <h3 className="text-base sm:text-lg font-black tracking-tight text-white mt-1">
          FINAL DEMAND FOR REPAYMENT
        </h3>
        <p className="text-[10px] text-slate-400 font-mono">
          Ref: FRB-RECOVERY-{Math.max(1, daysOwed)}D • High Risk Alert
        </p>
      </div>

      {/* Debtor Profile & CIBIL Score */}
      <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 mb-3.5 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Target Debtor
          </span>
          <span className="font-extrabold text-white text-sm truncate block">
            {friendName}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Friendship CIBIL
          </span>
          <span className="font-extrabold text-red-400 font-mono text-sm">
            310 (Critical Risk)
          </span>
        </div>
      </div>

      {/* Notice Narrative */}
      <div className="space-y-2.5 text-xs mb-3.5">
        <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/50">
          <div className="flex items-center justify-between text-[10px] text-red-300 font-bold mb-1">
            <span>OFFICIAL CLAIM</span>
            <span className="font-mono">{daysOwed} Days Overdue</span>
          </div>
          <p className="text-slate-200 text-xs leading-snug">
            Despite repeated assurances of <em>&ldquo;Bhai shaam ko pakka bhejta hoon&rdquo;</em>, our records show zero inward settlement for <strong>{primaryItem}</strong>.
          </p>
        </div>

        {/* Custom Roast Warning */}
        <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-200">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block mb-1">
            Official Enforcement Directive:
          </span>
          <p className="text-xs leading-relaxed text-amber-100 font-medium">
            {customRoastNote || "Failure to settle immediately will result in immediate loss of aux-cord privileges, bill-splitting exclusion, and unhinged roasting in the group chat."}
          </p>
        </div>
      </div>

      {/* Bottom Balance & Authority */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            Outstanding Liabilities:
          </span>
          <span className="text-2xl font-black font-mono text-red-400 tabular-nums">
            {formatINR(amount)}
          </span>
        </div>
        <div className="text-right">
          <p className="font-bold text-white text-xs">
            Emotional Distress Tribunal
          </p>
          <span className="text-[9px] text-slate-400 block">
            Enforcement Division
          </span>
        </div>
      </div>

      {/* Optional UPI ID Badge */}
      {showUpiBadge && upiId && (
        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 bg-slate-900 p-2 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-white truncate font-mono">
              Pay to: {upiId}
            </span>
          </div>
          <span className="text-[9px] uppercase font-black text-slate-950 px-2 py-0.5 rounded bg-emerald-400 shrink-0">
            Settle Debt
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 3. MEME RECEIPT (Thermal Cash Register Split)
 */
export function ThermalReceiptCard({
  friendName,
  amount,
  items,
  daysOwed,
  customRoastNote,
  showUpiBadge,
  upiId,
}: SarcasticCardProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto rounded-3xl bg-white text-slate-950 border-2 border-slate-300 p-5 sm:p-6 shadow-2xl relative overflow-hidden font-mono select-none">
      {/* Jagged / Dash receipt top header */}
      <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
        <h3 className="text-sm font-black tracking-widest uppercase">
          *** THE KINDNESS BISTRO ***
        </h3>
        <p className="text-[10px] text-slate-600 mt-0.5">
          Table: Friendship #404 • Server: Extreme Patience
        </p>
        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
          Customer: {friendName} • Days Unsettled: {daysOwed}
        </p>
      </div>

      {/* Itemized Table */}
      <div className="space-y-1.5 text-xs border-b border-dashed border-slate-400 pb-3 mb-3">
        <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase pb-1">
          <span>Item</span>
          <span>Amount</span>
        </div>
        {items.map((it, idx) => (
          <div key={idx} className="flex justify-between items-start gap-2">
            <span className="truncate max-w-[200px] text-slate-900 font-medium">
              1x {it.description}
            </span>
            <span className="font-bold text-slate-950 shrink-0 tabular-nums">
              {formatINR(it.amount)}
            </span>
          </div>
        ))}

        {/* Sarcastic line items */}
        <div className="flex justify-between text-slate-600 text-[11px] pt-1">
          <span>Emotional Distress Tax</span>
          <span className="font-mono">₹0.00</span>
        </div>
        <div className="flex justify-between text-slate-600 text-[11px]">
          <span>Audacity Surcharge</span>
          <span className="font-mono">₹0.00</span>
        </div>
        <div className="flex justify-between text-slate-600 text-[11px]">
          <span>Friendship Discount</span>
          <span className="font-mono">-₹0.00</span>
        </div>
      </div>

      {/* Total Amount Due */}
      <div className="border-b border-dashed border-slate-400 pb-3 mb-3">
        <div className="flex justify-between items-center text-sm font-black">
          <span className="uppercase tracking-wider">TOTAL UNPAID:</span>
          <span className="text-xl sm:text-2xl font-black text-slate-950 tabular-nums">
            {formatINR(amount)}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 italic">
          Payment Terms: Due 5 minutes ago via UPI.
        </p>
      </div>

      {/* Custom Roast Line */}
      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800 text-[11px] leading-relaxed mb-3 text-center border border-slate-200">
        &ldquo;{customRoastNote || "Thank you for dining on my generosity. Tips are not expected, but paying your share is mandatory."}&rdquo;
      </div>

      {/* Simulated Barcode */}
      <div className="text-center pt-1">
        <div className="h-9 tracking-widest text-xs font-serif font-black select-none text-slate-800 flex items-center justify-center overflow-hidden">
          ||| | |||| | || ||||| || | |||| ||| |||| | ||
        </div>
        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
          RECOVERY-REF-{Date.now().toString().slice(-8)}
        </p>
      </div>

      {/* Optional UPI ID Badge */}
      {showUpiBadge && upiId && (
        <div className="mt-3 pt-2.5 border-t border-slate-300 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <QrCode className="w-4 h-4 text-slate-900 shrink-0" />
            <span className="text-[11px] font-bold text-slate-900 truncate">
              UPI: {upiId}
            </span>
          </div>
          <span className="text-[9px] uppercase font-bold text-white px-2 py-0.5 rounded bg-slate-900 shrink-0">
            Pay Bill
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 4. BREAKING NEWS ALERT (TV Broadcast Live Chyron)
 */
export function BreakingNewsCard({
  friendName,
  amount,
  items,
  daysOwed,
  customRoastNote,
  showUpiBadge,
  upiId,
}: SarcasticCardProps) {
  const primaryItem = items[0]?.description || 'Unpaid Debt';

  return (
    <div className="w-full max-w-[420px] mx-auto rounded-3xl bg-slate-950 text-white border-2 border-red-600/60 shadow-2xl relative overflow-hidden font-sans select-none">
      {/* Top TV Channel Banner */}
      <div className="bg-red-600 px-4 py-2 flex items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
          <span className="text-xs font-black tracking-widest uppercase">
            BREAKING NEWS • LIVE
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
          <Tv className="w-3 h-3 text-red-200" />
          <span>FRIENDSHIP NEWS NETWORK</span>
        </div>
      </div>

      {/* Main Studio Anchor Frame */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Chyron Headline */}
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            PRIME TIME SCANDAL EXCLUSIVE
          </span>
          <h2 className="text-lg sm:text-xl font-black leading-tight text-white">
            Local Friend <span className="text-amber-400 underline decoration-red-500">{friendName}</span> Spotted Living Peacefully While Still Owing {formatINR(amount)}!
          </h2>
        </div>

        {/* Details & Location */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>INCIDENT: {primaryItem.toUpperCase()}</span>
            <span>OVERDUE: {daysOwed} DAYS</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Eyewitness reports confirm {friendName} was seen ordering expensive refreshments and smiling in photographs, despite owing a balance of{' '}
            <strong className="text-red-400 font-mono">{formatINR(amount)}</strong>.
          </p>
        </div>

        {/* Live Anchor Commentary / Roast Note */}
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-900/60">
          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block mb-0.5">
            Anchor Special Report:
          </span>
          <p className="text-xs text-red-100 font-medium leading-relaxed italic">
            &ldquo;{customRoastNote || "GPay servers are confirmed to be operating at 100% capacity nationwide. The only remaining mystery is the status of the friend's fingers."}&rdquo;
          </p>
        </div>

        {/* Lower Third Ticker */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              TOTAL OUTSTANDING:
            </span>
            <span className="text-2xl font-black font-mono text-amber-400 tabular-nums">
              {formatINR(amount)}
            </span>
          </div>
          <div className="text-right">
            <span className="inline-block px-2 py-1 rounded-md bg-red-600/30 text-red-300 border border-red-500/40 text-[10px] font-black tracking-wider uppercase">
              PAYMENT DUE NOW
            </span>
          </div>
        </div>

        {/* Optional UPI ID Badge */}
        {showUpiBadge && upiId && (
          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-white truncate font-mono">
                Settle via UPI: {upiId}
              </span>
            </div>
            <span className="text-[9px] uppercase font-black text-slate-950 px-2 py-0.5 rounded bg-emerald-400 shrink-0">
              Clear Scandal
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Master Template Selector
 */
export function SarcasticCard({
  templateId,
  ...props
}: SarcasticCardProps & { templateId: RoastPersonaId }) {
  switch (templateId) {
    case 'amnesia':
      return <AmnesiaClinicCard {...props} />;
    case 'bank_notice':
      return <BankNoticeCard {...props} />;
    case 'receipt':
      return <ThermalReceiptCard {...props} />;
    case 'breaking_news':
      return <BreakingNewsCard {...props} />;
    default:
      return <AmnesiaClinicCard {...props} />;
  }
}
