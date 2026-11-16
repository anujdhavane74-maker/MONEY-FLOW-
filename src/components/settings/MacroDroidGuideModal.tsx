'use client';

import React, { useState } from 'react';
import {
  Smartphone,
  Copy,
  Check,
  Zap,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  X,
  Play,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';
import { db } from '@/lib/db';
import { triggerCategorizationNotification } from '@/lib/notification';
import { Transaction } from '@/lib/types';

interface MacroDroidGuideModalProps {
  apiKey: string;
  onClose: () => void;
  onSimulated: (txn: Transaction) => void;
}

export function MacroDroidGuideModal({
  apiKey,
  onClose,
  onSimulated,
}: MacroDroidGuideModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const endpointUrl = `${originUrl}/api/ingest-sms`;

  const copyUrl = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSimulateWebhook = async () => {
    if (!apiKey) {
      alert('No webhook API key configured. Please rotate or generate a key in Settings.');
      return;
    }
    setSimulating(true);
    setSimSuccess(false);

    try {
      const samplePayload = {
        text: 'Sent Rs.140.00 from HDFC Bank A/c *1234 to ZOMATO on 17-11-26 via UPI. Ref 6321894512.',
        apiKey,
      };

      const res = await fetch('/api/ingest-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(samplePayload),
      });

      const json = await res.json();
      if (json.success && json.parsed) {
        // Save to DB
        const newTxnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newTxn: Transaction = {
          id: newTxnId,
          amount: json.parsed.amount,
          type: json.parsed.type || 'expense',
          category: 'Food & Dining',
          merchant: json.parsed.merchant || 'Zomato',
          rawMerchant: json.parsed.rawText,
          upiRefId: json.parsed.upiRefId,
          timestamp: Date.now(),
          source: 'webhook',
          bankOrApp: json.parsed.bankOrApp,
          notes: 'Simulated MacroDroid webhook test',
          isCategorized: false, // will prompt
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await db.transactions.add(newTxn);

        // Trigger Notification
        triggerCategorizationNotification({
          amount: newTxn.amount,
          merchant: newTxn.merchant,
          transactionId: newTxn.id,
        });

        setSimSuccess(true);
        setTimeout(() => {
          onSimulated(newTxn);
          onClose();
        }, 1200);
      } else {
        alert(`Simulation error: ${json.error || 'Failed'}`);
      }
    } catch (err: any) {
      alert(`Webhook simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Android Auto-SMS Automation</h2>
              <p className="text-xs text-slate-400">MacroDroid / Tasker / Shortcuts bridge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Endpoint & API Key Box */}
        <div className="space-y-2.5">
          {/* Endpoint URL */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Your Webhook REST Endpoint:
            </label>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
              <span className="truncate flex-1">{endpointUrl}</span>
              <button
                type="button"
                onClick={copyUrl}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Secured Header (X-API-Key):
            </label>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300">
              <span className="truncate flex-1">{apiKey}</span>
              <button
                type="button"
                onClick={copyKey}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Test Webhook Simulator Button */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-slate-800/40 to-slate-900 border border-cyan-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Test Ingestion Live
            </span>
            <span className="text-[10px] text-cyan-300">Simulates HDFC Zomato SMS</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Fires an authentic Indian UPI debit through the webhook to verify push notification & bottom-sheet prompt.
          </p>
          <button
            type="button"
            disabled={simulating}
            onClick={handleSimulateWebhook}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-98 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20"
          >
            {simSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Simulated! Opening Prompt...</span>
              </>
            ) : simulating ? (
              <span>Sending Webhook Payload...</span>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Test Webhook (₹140 at Zomato)</span>
              </>
            )}
          </button>
        </div>

        {/* Step-by-Step MacroDroid Guide */}
        <div className="space-y-2 text-xs text-slate-300">
          <p className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            MacroDroid Android Setup (2 Minutes):
          </p>
          <div className="space-y-2 text-slate-400">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="font-semibold text-slate-200">1. Trigger</p>
              <p className="text-[11px]">
                In MacroDroid, tap <strong>Triggers</strong> ➔ <strong>SMS Received</strong> (or Notification Received from GPay / PhonePe).
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="font-semibold text-slate-200">2. Action</p>
              <p className="text-[11px]">
                Tap <strong>Actions</strong> ➔ <strong>HTTP Request</strong>. Set Method to <strong>POST</strong> and paste the endpoint URL.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="font-semibold text-slate-200">3. Headers & Body</p>
              <p className="text-[11px]">
                Add Header: <code className="text-cyan-300">X-API-Key: {apiKey}</code>.
                Body: <code className="text-emerald-300">{`{"text": "[sms_message]"}`}</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
