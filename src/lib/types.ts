export type TransactionType = 'income' | 'expense' | 'savings';

export type TransactionSource = 'manual' | 'sms' | 'gpay_csv' | 'gpay_pdf' | 'webhook';

export interface SplitFriend {
  name: string;
  amount: number;
  settled: boolean;
}

export interface Transaction {
  id: string;
  amount: number; // NOTE: if split, this represents MY personal share, keeping spending charts accurate!
  type: TransactionType;
  category: string; // Category name or ID
  merchant: string;
  rawMerchant?: string;
  upiRefId?: string; // 12-digit UTR or Transaction ID
  timestamp: number; // Milliseconds timestamp (IST)
  source: TransactionSource;
  bankOrApp?: string; // e.g. 'GPay', 'PhonePe', 'HDFC', 'SBI', 'Bank of Maharashtra'
  notes?: string;
  isCategorized: boolean; // Flag to trigger instant categorization modal
  isSplit?: boolean;
  splitTotalAmount?: number; // Total bill paid at the counter (e.g. ₹600)
  myShareAmount?: number; // My personal share (e.g. ₹200)
  splitFriends?: SplitFriend[];
  createdAt: number;
  updatedAt: number;
}

export interface IOU {
  id: string;
  transactionId?: string;
  personName: string;
  amount: number;
  status: 'pending' | 'settled';
  description: string;
  createdAt: number;
  settledAt?: number;
  settledViaTxnId?: string;
}

export interface QuickSpendPreset {
  id: string;
  name: string;
  amount: number;
  category: string;
  icon: string;
}

export interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  category: string;
  billingCycle: 'monthly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  autoPay: boolean;
  isActive: boolean;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string; // Lucide icon key
  color: string; // Hex color code
  isDefault: boolean;
  budgetMonthly?: number;
}

export interface MerchantRule {
  id: string;
  keyword: string; // Normalized lowercase merchant/UPI keyword
  categoryId: string; // Category to auto-assign
  confidence: number; // 0 to 1
  createdAt: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
  color?: string;
  createdAt: number;
}

export interface ParentShareToken {
  token: string;
  label: string;
  createdAt: number;
  expiresAt?: number;
  revoked: boolean;
}

export interface AppSettings {
  id: string; // always 'global'
  pinHash: string | null;
  pinEnabled: boolean;
  autoLockMinutes: number; // Default: 5 minutes
  currency: string; // Default: 'INR'
  theme: 'dark' | 'light' | 'system';
  monthlyBudget: number; // Default: ₹25,000 for Safe-to-Spend formula
  fixedRecurringBills: number; // Summed from active recurring bills or fallback
  apiKey: string; // X-API-Key for MacroDroid/Tasker Webhook
  hideNotesFromParent: boolean; // Privacy setting for Parent Guardian View
  parentShareTokens: ParentShareToken[];
  lastActive: number;
  webhookSecret?: string;
}

export interface ParsedSmsResult {
  success: boolean;
  amount?: number;
  type?: TransactionType;
  merchant?: string;
  bankOrApp?: string;
  upiRefId?: string;
  timestamp?: number;
  rawText?: string;
  errorMessage?: string;
}

export interface DeduplicationMatchResult {
  status: 'merged' | 'inserted' | 'skipped';
  transaction: Transaction;
  matchedBy?: 'exact_upi_id' | 'fuzzy_amount_time';
  existingId?: string;
}

export interface ImportSummary {
  totalParsed: number;
  mergedCount: number;
  newCount: number;
  skippedCount: number;
  transactions: DeduplicationMatchResult[];
}
