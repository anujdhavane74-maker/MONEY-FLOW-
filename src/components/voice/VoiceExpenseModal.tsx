'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Sparkles,
  CheckCircle2,
  X,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { Transaction } from '@/lib/types';
import { formatINR, cleanMerchantName } from '@/lib/formatters';
import { db, predictCategory } from '@/lib/db';

interface VoiceExpenseModalProps {
  onClose: () => void;
  onAdded: (txn: Transaction) => void;
}

interface ParsedVoiceData {
  amount: number;
  merchant: string;
  type: 'expense' | 'income';
  category: string;
  isSplit: boolean;
  splitFriendName?: string;
}

export function VoiceExpenseModal({ onClose, onAdded }: VoiceExpenseModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<ParsedVoiceData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English accent & keywords

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg('');
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript;
      setTranscript(text);

      if (event.results[current].isFinal) {
        parseVoiceText(text);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error !== 'no-speech') {
        setErrorMsg(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // ignore
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Smart Voice NLP Parser
  const parseVoiceText = async (text: string) => {
    const clean = text.toLowerCase().trim();

    // 1. Detect Type
    let type: 'expense' | 'income' = 'expense';
    if (/\b(received|got|credited|income|salary|allowance|from dad|from papa)\b/i.test(clean)) {
      type = 'income';
    }

    // 2. Extract Amount
    let amount = 0;
    const amtMatch = clean.match(
      /(?:spent|paid|amount of|rs\.?|rupees|₹)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:rupees|rs\.?|₹|bucks)?/i
    );
    if (amtMatch && amtMatch[1]) {
      amount = parseFloat(amtMatch[1].replace(/,/g, ''));
    } else if (clean.includes('hundred')) {
      amount = 100;
    } else if (clean.includes('fifty')) {
      amount = 50;
    }

    if (amount <= 0) {
      setErrorMsg('Could not detect amount. Please speak clearly (e.g. "Spent 120 on coffee")');
      return;
    }

    // 3. Extract Split
    let isSplit = false;
    let splitFriendName = '';
    const splitMatch = clean.match(/split\s+(?:with\s+)?([a-z]+)/i);
    if (splitMatch && splitMatch[1]) {
      isSplit = true;
      splitFriendName = splitMatch[1].charAt(0).toUpperCase() + splitMatch[1].slice(1);
    }

    // 4. Extract Merchant / Description
    let merchant = 'Quick Voice Spend';
    const merchantMatch = clean.match(/(?:on|for|at|to|from)\s+([a-z0-9\s.&'-]+?)(?:\s+(?:with|split|via)|\.|$)/i);
    if (merchantMatch && merchantMatch[1]) {
      merchant = cleanMerchantName(merchantMatch[1].trim());
    } else {
      const words = clean.replace(/^(spent|paid|received|got|\d+|rupees|rs|for|on|at)\s+/g, '');
      if (words.length > 2) merchant = cleanMerchantName(words);
    }

    // 5. Predict Category
    const category = (await predictCategory(merchant)) || 'Food & Dining';

    setParsedData({
      amount,
      merchant,
      type,
      category,
      isSplit,
      splitFriendName,
    });

    // Start 2-second auto-save countdown
    setCountdown(2);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev !== null && prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleCommit({
            amount,
            merchant,
            type,
            category,
            isSplit,
            splitFriendName,
          });
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
  };

  const handleCommit = async (data: ParsedVoiceData) => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(60);
      } catch {
        // ignore
      }
    }

    const newTxnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const myShare = data.isSplit ? Math.round((data.amount / 2) * 100) / 100 : data.amount;

    const newTxn: Transaction = {
      id: newTxnId,
      amount: myShare,
      type: data.type,
      category: data.category,
      merchant: data.merchant,
      timestamp: Date.now(),
      source: 'manual',
      notes: `Voice input: "${transcript}"`,
      isCategorized: true,
      isSplit: data.isSplit,
      splitTotalAmount: data.amount,
      myShareAmount: myShare,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.transactions.add(newTxn);

    if (data.isSplit && data.splitFriendName) {
      await db.ious.add({
        id: `iou-${Date.now()}`,
        transactionId: newTxnId,
        personName: data.splitFriendName,
        amount: data.amount - myShare,
        status: 'pending',
        description: `${data.merchant} (Voice Split)`,
        createdAt: Date.now(),
      });
    }

    onAdded(newTxn);
    onClose();
  };

  const restartListening = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(null);
    setParsedData(null);
    setTranscript('');
    setErrorMsg('');
    try {
      recognitionRef.current?.start();
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Voice-to-Expense NLP
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pulsing Mic Visualizer */}
        <div className="py-2 flex flex-col items-center">
          <div className="relative">
            <button
              type="button"
              onClick={restartListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-rose-50 border-2 border-rose-500 text-rose-600 dark:bg-rose-500/20 dark:border-rose-500 dark:text-rose-400 shadow-xl scale-105'
                  : 'bg-emerald-50 border-2 border-emerald-500 text-emerald-600 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-400'
              }`}
            >
              {isListening ? (
                <Mic className="w-8 h-8 animate-pulse text-rose-600 dark:text-rose-400" />
              ) : (
                <Volume2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              )}
            </button>
            {isListening && (
              <div className="absolute -inset-2 rounded-full border border-rose-500/40 animate-ping pointer-events-none" />
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
            {isListening ? 'Listening in Indian English (en-IN)...' : 'Tap mic to speak again'}
          </p>
        </div>

        {/* Live Transcript Bubble */}
        {transcript && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 italic">
            &ldquo;{transcript}&rdquo;
          </div>
        )}

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Parsed Confirmation Card */}
        {parsedData && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-left space-y-2 animate-slide-up">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Merchant / Item:</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{parsedData.merchant}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Parsed Amount:</span>
              <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatINR(parsedData.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">Category:</span>
              <span className="text-xs text-cyan-700 dark:text-cyan-300 font-semibold">{parsedData.category}</span>
            </div>
            {parsedData.isSplit && (
              <div className="flex justify-between items-center pt-1 border-t border-emerald-200 dark:border-emerald-800/40 text-[11px] text-cyan-700 dark:text-cyan-300">
                <span>Split with {parsedData.splitFriendName}:</span>
                <span className="font-mono tabular-nums">Your share: {formatINR(parsedData.amount / 2)}</span>
              </div>
            )}

            {/* Countdown Auto-Save Bar */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setCountdown(null);
                  setParsedData(null);
                }}
                className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCommit(parsedData)}
                className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {countdown ? `Auto-saving in ${countdown}s...` : 'Save Now'}
              </button>
            </div>
          </div>
        )}

        {/* Spoken Samples Guide */}
        {!parsedData && (
          <div className="text-[11px] text-slate-400 dark:text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600 dark:text-slate-400">Try saying:</p>
            <p>&bull; &ldquo;Spent 120 rupees on cold coffee&rdquo;</p>
            <p>&bull; &ldquo;Paid 45 for PMPML bus ticket&rdquo;</p>
            <p>&bull; &ldquo;Split 600 dinner with Rahul&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
