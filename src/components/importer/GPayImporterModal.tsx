'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import {
  FileSpreadsheet,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { Transaction, ImportSummary, DeduplicationMatchResult } from '@/lib/types';
import { reconcileIncomingTransactions, commitReconciliation } from '@/lib/deduplication';
import { cleanMerchantName, formatINR, formatISTDate } from '@/lib/formatters';
import { sanitizeString } from '@/lib/validations';

interface GPayImporterModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function GPayImporterModal({ onClose, onImportComplete }: GPayImporterModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Handle File Upload with Strict Validation & Magic-Byte Checks
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Reset state
    setErrorMsg('');
    setImportSummary(null);

    // Security Check: Cap file size at 5MB to prevent browser memory exhaustion / DoS
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMsg('File exceeds maximum allowed size of 5MB. Please upload a smaller statement.');
      return;
    }

    // Security Check: Enforce allowed extensions & MIME types
    const fileName = selected.name.toLowerCase();
    const isCsvExt = fileName.endsWith('.csv') || fileName.endsWith('.txt');
    const isPdfExt = fileName.endsWith('.pdf');

    if (!isCsvExt && !isPdfExt) {
      setErrorMsg('Unsupported file type. Please upload a valid .csv or .pdf Google Pay statement.');
      return;
    }

    try {
      // Magic Bytes & Content Inspection
      const sliceBuffer = await selected.slice(0, 1024).arrayBuffer();
      const uint8 = new Uint8Array(sliceBuffer);

      if (isPdfExt) {
        // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
        const isPdfMagic =
          uint8[0] === 0x25 &&
          uint8[1] === 0x50 &&
          uint8[2] === 0x44 &&
          uint8[3] === 0x46 &&
          uint8[4] === 0x2d;

        if (!isPdfMagic) {
          setErrorMsg('Invalid PDF file: File signature does not match a genuine PDF document.');
          return;
        }
        setFile(selected);
        await parsePdfFile(selected);
      } else if (isCsvExt) {
        // CSV Validation: Check for binary null bytes (\0) which indicate a disguised binary/exe
        let hasNullBytes = false;
        for (let i = 0; i < uint8.length; i++) {
          if (uint8[i] === 0x00) {
            hasNullBytes = true;
            break;
          }
        }
        if (hasNullBytes) {
          setErrorMsg('Invalid CSV file: Binary characters detected. Please upload a plain text CSV.');
          return;
        }
        setFile(selected);
        await parseCsvFile(selected);
      }
    } catch (err) {
      setErrorMsg('Failed to verify file security headers. Please try another file.');
    }
  };

  // 2. CSV Parser
  const parseCsvFile = async (csvFile: File) => {
    setParsing(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const parsedTransactions = parseGooglePayCsvRows(results.data);
          if (parsedTransactions.length === 0) {
            setErrorMsg('No recognizable Google Pay transaction rows found in CSV.');
            setParsing(false);
            return;
          }

          const summary = await reconcileIncomingTransactions(parsedTransactions);
          setImportSummary(summary);
        } catch (err: any) {
          setErrorMsg(err.message || 'Error processing CSV rows.');
        } finally {
          setParsing(false);
        }
      },
      error: (err) => {
        setErrorMsg(`CSV Parse Failed: ${err.message}`);
        setParsing(false);
      },
    });
  };

  // 3. PDF Parser (uses dynamic import of pdfjs-dist or text line extraction)
  const parsePdfFile = async (pdfFile: File) => {
    setParsing(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let extractedFullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        extractedFullText += `\n${pageStrings}`;
      }

      const parsedTransactions = parseGPayPdfText(extractedFullText);
      if (parsedTransactions.length === 0) {
        setErrorMsg('Could not detect Google Pay statement rows in this PDF.');
        setParsing(false);
        return;
      }

      const summary = await reconcileIncomingTransactions(parsedTransactions);
      setImportSummary(summary);
    } catch (err: any) {
      console.warn('PDF.js parsing failed, fallback parsing:', err);
      setErrorMsg(`PDF Parse Error: ${err.message || 'Please upload the CSV export for faster processing.'}`);
    } finally {
      setParsing(false);
    }
  };

  // 4. Sample Statement Loader (Demo)
  const handleLoadSampleStatement = async () => {
    setParsing(true);
    setErrorMsg('');
    const now = Date.now();
    const day = 86400000;

    // Mixed sample: some matching existing seed (Anand Vadapav, Swiggy, PMPML), some fuzzy, some brand new
    const sampleIncoming: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // 1. Exact Match on UPI Ref: Anand Vadapav
      {
        amount: 150,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Anand Vadapav Stall',
        rawMerchant: 'GPay/ANAND VADAPAV/anand@okhdfcbank/418291029182',
        upiRefId: '418291029182', // matches seed txn-4!
        timestamp: now - day * 2 - 3600000 * 3,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        notes: 'Statement export row',
        isCategorized: true,
      },
      // 2. Exact Match on UPI Ref: Swiggy
      {
        amount: 349,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Swiggy Bundl Technologies',
        rawMerchant: 'GPay/SWIGGY/420192039485',
        upiRefId: '420192039485', // matches seed txn-6!
        timestamp: now - day * 1 - 3600000 * 2,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: true,
      },
      // 3. Fuzzy Match (identical amount 199 + type expense + within 2 minutes, lacking UPI ID in SMS)
      {
        amount: 199,
        type: 'expense',
        category: 'Subscriptions & Gaming',
        merchant: 'Spotify India Ltd',
        rawMerchant: 'UPI/SPOTIFY/spotify@icici/421992019283',
        upiRefId: '421992019283', // SMS lacked UTR, statement provides it!
        timestamp: now - day * 5 + 60000, // +1 minute difference!
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: true,
      },
      // 4. Brand New: Zepto Quick Delivery
      {
        amount: 420,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Zepto Quick Delivery',
        rawMerchant: 'UPI/ZEPTO/zepto@icici/422019283912',
        upiRefId: '422019283912',
        timestamp: now - 3600000 * 14,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: false,
      },
      // 5. Brand New: D-Mart Grocery
      {
        amount: 2150,
        type: 'expense',
        category: 'Shopping',
        merchant: 'Avenue Supermarts (D-Mart)',
        rawMerchant: 'UPI/DMART/dmart@hdfc/422102938491',
        upiRefId: '422102938491',
        timestamp: now - day * 3,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: false,
      },
      // 6. Brand New: Cafe Goodluck Maska Bun
      {
        amount: 180,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Cafe Goodluck Pune',
        rawMerchant: 'UPI/GOODLUCK/goodluck@icici/422201928394',
        upiRefId: '422201928394',
        timestamp: now - day * 2 - 3600000 * 7,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: false,
      },
      // 7. Brand New Income: Freelance Frontend Design
      {
        amount: 12500,
        type: 'income',
        category: 'Freelance & Side Gigs',
        merchant: 'Client Direct Transfer (Freelance)',
        rawMerchant: 'UPI/UPWORK CLIENT/client@axis/422301928391',
        upiRefId: '422301928391',
        timestamp: now - day * 4,
        source: 'gpay_csv',
        bankOrApp: 'Google Pay',
        isCategorized: true,
      },
    ];

    setTimeout(async () => {
      const summary = await reconcileIncomingTransactions(sampleIncoming);
      setImportSummary(summary);
      setParsing(false);
    }, 400);
  };

  // 5. Commit Reconciled Transactions
  const handleCommit = async () => {
    if (!importSummary) return;
    setIsCommitting(true);

    try {
      const result = await commitReconciliation(importSummary.transactions);
      alert(
        `Reconciliation Complete!\n• ${result.merged} transactions merged & enriched with statement metadata\n• ${result.inserted} genuinely new transactions added to your vault`
      );
      onImportComplete();
      onClose();
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 text-slate-900 dark:text-slate-100 flex flex-col max-h-[90dvh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-1 sm:hidden shrink-0" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">GPay Statement Importer</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fuzzy & exact deduplication merge engine (CSV & PDF)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Upload or Demo */}
        {!importSummary && (
          <div className="space-y-4">
            {/* Dropzone */}
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500/80 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
              <UploadCloud className="w-12 h-12 text-blue-500 dark:text-blue-400 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Drop your Google Pay CSV or PDF statement here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supports exports from Google Pay, PhonePe, Paytm, and Indian Bank UPI statements
              </p>
              <input
                type="file"
                accept=".csv,.pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Quick Demo Test Option */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Try Sample Google Pay Statement
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Simulate importing 7 transactions to test deduplication & merging live
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleStatement}
                disabled={parsing}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors"
              >
                {parsing ? 'Parsing...' : 'Load Sample'}
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Reconciliation Preview Summary */}
        {importSummary && (
          <div className="space-y-4 animate-fade-in">
            {/* Top Stat Pills */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Rows</span>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {importSummary.totalParsed}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50">
                <span className="text-[10px] text-cyan-700 dark:text-cyan-400 uppercase font-semibold">
                  Already Synced
                </span>
                <p className="text-xl font-bold font-mono text-cyan-800 dark:text-cyan-300 tabular-nums">
                  {importSummary.mergedCount}
                </p>
                <span className="text-[9px] text-cyan-600 dark:text-cyan-500">Merged / Enriched</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">
                  New Transactions
                </span>
                <p className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {importSummary.newCount}
                </p>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-500">Will be added</span>
              </div>
            </div>

            {/* Invariant Explanation Banner */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>
                <strong>Intelligent Deduplication Active:</strong> Merged transactions enrich missing
                UPI Reference IDs without overwriting your custom categories or notes.
              </span>
            </div>

            {/* Transaction Matching Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {importSummary.transactions.map((item, idx) => {
                  const isMerged = item.status === 'merged';
                  const txn = item.transaction;

                  return (
                    <div
                      key={idx}
                      className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isMerged
                              ? 'bg-cyan-100 border border-cyan-300 text-cyan-800 dark:bg-cyan-950/60 dark:border-cyan-800/60 dark:text-cyan-300'
                              : 'bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-300'
                          }`}
                        >
                          {isMerged
                            ? item.matchedBy === 'exact_upi_id'
                              ? 'Merged (UTR Match)'
                              : 'Merged (Fuzzy ±5m)'
                            : 'New Record'}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{txn.merchant}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{txn.category}</span>
                            {txn.upiRefId && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">UTR: {txn.upiRefId}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-bold font-mono tabular-nums ${
                            txn.type === 'expense' ? 'text-slate-800 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {txn.type === 'expense' ? '-' : '+'}{formatINR(txn.amount)}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                          {formatISTDate(txn.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Commit / Cancel Controls */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Reset / Back
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting}
                className="flex-1 py-3 min-h-[44px] rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 hover:brightness-110 active:scale-98 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                Commit Reconciliation ({importSummary.mergedCount} Merged, {importSummary.newCount} Added)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helpers for CSV / PDF data extraction with Universal Auto-Mapping (GPay, Indian Banks, Revolut, Chase, Wise, Monzo)
function parseGooglePayCsvRows(rows: any[]): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] {
  const parsedList: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;

    // 1. Column discovery helper (case-insensitive fuzzy key match)
    const getVal = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
          return String(row[found]).trim();
        }
      }
      return undefined;
    };

    // 2. Amount & Type Detection (Handles separate Debit/Credit columns or single Amount)
    const debitVal = getVal('debit', 'withdrawal', 'amount (debit)', 'paid out', 'spent');
    const creditVal = getVal('credit', 'deposit', 'amount (credit)', 'paid in', 'received');
    const genericAmount = getVal('amount', 'amount (inr)', 'transaction amount', 'total', 'net amount', 'value');

    let amount = 0;
    let type: 'income' | 'expense' | 'savings' = 'expense';

    if (debitVal && parseFloat(debitVal.replace(/[^0-9.]/g, '')) > 0) {
      amount = parseFloat(debitVal.replace(/[^0-9.]/g, ''));
      type = 'expense';
    } else if (creditVal && parseFloat(creditVal.replace(/[^0-9.]/g, '')) > 0) {
      amount = parseFloat(creditVal.replace(/[^0-9.]/g, ''));
      type = 'income';
    } else if (genericAmount) {
      const isExplicitNegative = genericAmount.startsWith('-') || genericAmount.includes('DR');
      const isExplicitPositive = genericAmount.startsWith('+') || genericAmount.includes('CR');
      amount = Math.abs(parseFloat(genericAmount.replace(/[^0-9.]/g, '')));

      const rawType = getVal('type', 'transaction type', 'status', 'dr/cr', 'direction')?.toLowerCase() || '';
      if (isExplicitPositive || rawType.includes('received') || rawType.includes('credit') || rawType === 'cr') {
        type = 'income';
      } else {
        type = 'expense';
      }
    }

    if (isNaN(amount) || amount <= 0) continue;

    // 3. Counterparty / Merchant Name
    const rawMerchant =
      getVal(
        'description',
        'narration',
        'particulars',
        'merchant',
        'payee',
        'counterparty',
        'to',
        'from',
        'details',
        'transaction details',
        'name'
      ) || 'Financial Counterparty';

    const cleanMerchant = sanitizeString(
      cleanMerchantName(rawMerchant).replace(/^[=+\-@\t\r]+/, '')
    );

    // 4. UPI Ref / Reference / Transaction ID
    const upiRefId = getVal(
      'upi transaction id',
      'transaction id',
      'reference id',
      'utr',
      'ref no',
      'reference',
      'chq / ref no',
      'id'
    );

    // 5. Date / Time Parsing
    const rawDate = getVal(
      'date',
      'transaction date',
      'posting date',
      'value date',
      'time',
      'timestamp',
      'booking date',
      'completed date'
    );
    let timestamp = Date.now();
    if (rawDate) {
      const parsedTs = new Date(rawDate).getTime();
      if (!isNaN(parsedTs) && parsedTs > 946684800000) {
        timestamp = parsedTs;
      }
    }

    parsedList.push({
      amount,
      type,
      category: 'Uncategorized',
      merchant: cleanMerchant || 'Unknown Merchant',
      rawMerchant: sanitizeString(rawMerchant).slice(0, 120),
      upiRefId: upiRefId ? sanitizeString(upiRefId).slice(0, 50) : undefined,
      timestamp,
      source: 'gpay_csv',
      bankOrApp: 'Statement Import',
      isCategorized: false,
    });
  }

  return parsedList;
}

function parseGPayPdfText(text: string): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] {
  const parsedList: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.includes('₹') || /paid|received|debited|credited/i.test(line)) {
      const matchAmt = line.match(/(?:₹|INR|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
      if (matchAmt && matchAmt[1]) {
        const amount = parseFloat(matchAmt[1].replace(/,/g, ''));
        const type = /received|credited/i.test(line) ? 'income' : 'expense';

        // Match 12-digit UPI ref
        const matchUpi = line.match(/\b([0-9]{12})\b/);
        const upiRefId = matchUpi ? matchUpi[1] : undefined;

        parsedList.push({
          amount,
          type,
          category: 'Uncategorized',
          merchant: 'GPay PDF Extract',
          rawMerchant: sanitizeString(line.slice(0, 80)),
          upiRefId,
          timestamp: Date.now(),
          source: 'gpay_pdf',
          bankOrApp: 'Google Pay',
          isCategorized: false,
        });
      }
    }
  }

  return parsedList;
}
