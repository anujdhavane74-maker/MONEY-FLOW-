import Dexie, { Table } from 'dexie';
import {
  Transaction,
  Category,
  MerchantRule,
  SavingsGoal,
  AppSettings,
  ParentShareToken,
  IOU,
  QuickSpendPreset,
  RecurringBill,
} from './types';
import { generateSecureToken } from './crypto';

export class MoneyFlowDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  merchant_rules!: Table<MerchantRule, string>;
  savings_goals!: Table<SavingsGoal, string>;
  app_settings!: Table<AppSettings, string>;
  ious!: Table<IOU, string>;
  quick_presets!: Table<QuickSpendPreset, string>;
  recurring_bills!: Table<RecurringBill, string>;

  constructor() {
    super('MoneyFlowDB');

    this.version(1).stores({
      transactions: 'id, type, category, timestamp, upiRefId, merchant, isCategorized, source, createdAt',
      categories: 'id, type, name, isDefault',
      merchant_rules: 'id, keyword, categoryId',
      savings_goals: 'id, title, createdAt',
      app_settings: 'id',
    });

    this.version(2).stores({
      transactions: 'id, type, category, timestamp, upiRefId, merchant, isCategorized, source, createdAt',
      categories: 'id, type, name, isDefault',
      merchant_rules: 'id, keyword, categoryId',
      savings_goals: 'id, title, createdAt',
      app_settings: 'id',
      ious: 'id, transactionId, personName, status, createdAt',
      quick_presets: 'id, name, amount',
    });

    this.version(3).stores({
      transactions: 'id, type, category, timestamp, upiRefId, merchant, isCategorized, source, createdAt',
      categories: 'id, type, name, isDefault',
      merchant_rules: 'id, keyword, categoryId',
      savings_goals: 'id, title, createdAt',
      app_settings: 'id',
      ious: 'id, transactionId, personName, status, createdAt',
      quick_presets: 'id, name, amount',
      recurring_bills: 'id, title, nextDueDate, isActive, category',
    });
  }
}

export const db = new MoneyFlowDatabase();

// Default seed categories
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Dining', type: 'expense', icon: 'UtensilsCrossed', color: '#f97316', isDefault: true, budgetMonthly: 6000 },
  { id: 'cat-shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', isDefault: true, budgetMonthly: 4000 },
  { id: 'cat-travel', name: 'Travel & Transit', type: 'expense', icon: 'Car', color: '#06b6d4', isDefault: true, budgetMonthly: 3000 },
  { id: 'cat-education', name: 'Stationery & Education', type: 'expense', icon: 'GraduationCap', color: '#8b5cf6', isDefault: true, budgetMonthly: 2500 },
  { id: 'cat-bills', name: 'Rent & Bills', type: 'expense', icon: 'Home', color: '#ef4444', isDefault: true, budgetMonthly: 12000 },
  { id: 'cat-gaming', name: 'Subscriptions & Gaming', type: 'expense', icon: 'Gamepad2', color: '#a855f7', isDefault: true, budgetMonthly: 1500 },
  { id: 'cat-transfers', name: 'Transfers', type: 'expense', icon: 'ArrowRightLeft', color: '#64748b', isDefault: true },
  { id: 'cat-savings', name: 'Savings & Investments', type: 'savings', icon: 'PiggyBank', color: '#10b981', isDefault: true },
  // Incomes
  { id: 'cat-salary', name: 'Salary / Stipend', type: 'income', icon: 'Briefcase', color: '#10b981', isDefault: true },
  { id: 'cat-allowance', name: 'Pocket Money / Allowance', type: 'income', icon: 'Coins', color: '#06b6d4', isDefault: true },
  { id: 'cat-freelance', name: 'Freelance & Side Gigs', type: 'income', icon: 'Laptop', color: '#3b82f6', isDefault: true },
  { id: 'cat-cashback', name: 'Cashback & Refunds', type: 'income', icon: 'Sparkles', color: '#14b8a6', isDefault: true },
];

export const DEFAULT_PRESETS: QuickSpendPreset[] = [
  { id: 'preset-chai', name: '☕ Cutting Chai', amount: 15, category: 'Food & Dining', icon: 'Coffee' },
  { id: 'preset-vadapav', name: '🥪 Vadapav', amount: 20, category: 'Food & Dining', icon: 'UtensilsCrossed' },
  { id: 'preset-bus', name: '🚌 PMPML Bus', amount: 25, category: 'Travel & Transit', icon: 'Bus' },
  { id: 'preset-auto', name: '🛺 Shared Auto', amount: 30, category: 'Travel & Transit', icon: 'Car' },
  { id: 'preset-coffee', name: '🥤 Cold Coffee', amount: 50, category: 'Food & Dining', icon: 'Coffee' },
  { id: 'preset-groceries', name: '🥛 Milk & Eggs', amount: 65, category: 'Shopping', icon: 'ShoppingBag' },
];

export const DEFAULT_RECURRING_BILLS: RecurringBill[] = [
  {
    id: 'bill-rent',
    title: 'Room Rent & Society Maintenance',
    amount: 12000,
    category: 'Rent & Bills',
    billingCycle: 'monthly',
    nextDueDate: '2026-11-20',
    autoPay: false,
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'bill-jio',
    title: 'Jio 5G Prepaid Recharge',
    amount: 349,
    category: 'Rent & Bills',
    billingCycle: 'monthly',
    nextDueDate: '2026-11-19',
    autoPay: true,
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'bill-spotify',
    title: 'Spotify Student Premium',
    amount: 59,
    category: 'Subscriptions & Gaming',
    billingCycle: 'monthly',
    nextDueDate: '2026-11-22',
    autoPay: true,
    isActive: true,
    createdAt: Date.now(),
  },
  {
    id: 'bill-wifi',
    title: 'Airtel Xstream Fiber Broadband',
    amount: 799,
    category: 'Rent & Bills',
    billingCycle: 'monthly',
    nextDueDate: '2026-11-28',
    autoPay: false,
    isActive: true,
    createdAt: Date.now(),
  },
];

// Default smart auto-categorization rules
export const DEFAULT_MERCHANT_RULES: Omit<MerchantRule, 'id' | 'createdAt'>[] = [
  { keyword: 'pmpml', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'metro', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'uber', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'ola', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'irctc', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'rapido', categoryId: 'cat-travel', confidence: 0.95 },
  { keyword: 'swiggy', categoryId: 'cat-food', confidence: 0.95 },
  { keyword: 'zomato', categoryId: 'cat-food', confidence: 0.95 },
  { keyword: 'zepto', categoryId: 'cat-food', confidence: 0.9 },
  { keyword: 'blinkit', categoryId: 'cat-food', confidence: 0.9 },
  { keyword: 'anand vadapav', categoryId: 'cat-food', confidence: 0.98 },
  { keyword: 'royal sweet', categoryId: 'cat-food', confidence: 0.98 },
  { keyword: 'mcdonald', categoryId: 'cat-food', confidence: 0.95 },
  { keyword: 'starbucks', categoryId: 'cat-food', confidence: 0.95 },
  { keyword: 'chai', categoryId: 'cat-food', confidence: 0.85 },
  { keyword: 'amazon', categoryId: 'cat-shopping', confidence: 0.9 },
  { keyword: 'flipkart', categoryId: 'cat-shopping', confidence: 0.9 },
  { keyword: 'dmart', categoryId: 'cat-shopping', confidence: 0.95 },
  { keyword: 'myntra', categoryId: 'cat-shopping', confidence: 0.95 },
  { keyword: 'zara', categoryId: 'cat-shopping', confidence: 0.95 },
  { keyword: 'netflix', categoryId: 'cat-gaming', confidence: 0.98 },
  { keyword: 'spotify', categoryId: 'cat-gaming', confidence: 0.98 },
  { keyword: 'steam', categoryId: 'cat-gaming', confidence: 0.98 },
  { keyword: 'playstation', categoryId: 'cat-gaming', confidence: 0.98 },
  { keyword: 'jio', categoryId: 'cat-bills', confidence: 0.9 },
  { keyword: 'airtel', categoryId: 'cat-bills', confidence: 0.9 },
  { keyword: 'bescom', categoryId: 'cat-bills', confidence: 0.95 },
  { keyword: 'mseb', categoryId: 'cat-bills', confidence: 0.95 },
  { keyword: 'zerodha', categoryId: 'cat-savings', confidence: 0.98 },
  { keyword: 'groww', categoryId: 'cat-savings', confidence: 0.98 },
];

export async function initializeDatabase() {
  if (typeof window === 'undefined') return;

  // 1. Seed Categories if empty
  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  // 2. Seed Quick Presets if empty
  const presetsCount = await db.quick_presets.count();
  if (presetsCount === 0) {
    await db.quick_presets.bulkAdd(DEFAULT_PRESETS);
  }

  // 3. Seed Recurring Bills if empty
  const billsCount = await db.recurring_bills.count();
  if (billsCount === 0) {
    await db.recurring_bills.bulkAdd(DEFAULT_RECURRING_BILLS);
  }

  // 4. Seed Merchant Rules if empty
  const rulesCount = await db.merchant_rules.count();
  if (rulesCount === 0) {
    const rulesToInsert = DEFAULT_MERCHANT_RULES.map((rule, idx) => ({
      ...rule,
      id: `rule-${idx + 1}`,
      createdAt: Date.now(),
    }));
    await db.merchant_rules.bulkAdd(rulesToInsert);
  }

  // 5. Seed App Settings if empty
  const settings = await db.app_settings.get('global');
  if (!settings) {
    const defaultSettings: AppSettings = {
      id: 'global',
      pinHash: null,
      pinEnabled: false,
      autoLockMinutes: 5,
      currency: 'INR',
      theme: 'dark',
      monthlyBudget: 25000,
      fixedRecurringBills: 13207, // Auto-computed from recurring bills
      apiKey: generateSecureToken(32),
      hideNotesFromParent: false,
      parentShareTokens: [
        {
          token: 'demo-parent-guardian-2026',
          label: 'Family Guardian Link (Sample)',
          createdAt: Date.now() - 86400000 * 7,
          revoked: false,
        },
      ],
      lastActive: Date.now(),
    };
    await db.app_settings.put(defaultSettings);
  } else {
    // Migration for missing fields
    const updates: Partial<AppSettings> = {};
    if (!settings.monthlyBudget) updates.monthlyBudget = 25000;
    if (!settings.apiKey) updates.apiKey = generateSecureToken(32);
    if (settings.hideNotesFromParent === undefined) updates.hideNotesFromParent = false;
    if (Object.keys(updates).length > 0) {
      await db.app_settings.update('global', updates);
    }
  }

  // 6. Seed sample IOUs if empty
  const iousCount = await db.ious.count();
  if (iousCount === 0) {
    const now = Date.now();
    const day = 86400000;
    const sampleIOUs: IOU[] = [
      {
        id: 'iou-1',
        personName: 'Rahul',
        amount: 200,
        status: 'pending',
        description: 'Dhaba Dinner (Friday Night)',
        createdAt: now - day * 2,
      },
      {
        id: 'iou-2',
        personName: 'Priya',
        amount: 150,
        status: 'pending',
        description: 'Uber to College Campus',
        createdAt: now - day * 1,
      },
    ];
    await db.ious.bulkAdd(sampleIOUs);
  }

  // 7. Seed initial realistic transactions & savings goals if database is fresh
  const txnCount = await db.transactions.count();
  if (txnCount === 0) {
    const now = Date.now();
    const day = 86400000;

    const sampleTransactions: Transaction[] = [
      {
        id: 'txn-1',
        amount: 35000,
        type: 'income',
        category: 'Salary / Stipend',
        merchant: 'TCS Innovation Labs',
        rawMerchant: 'NEFT CR TCS INNOVATION 98127391',
        timestamp: now - day * 12,
        source: 'manual',
        bankOrApp: 'HDFC Bank',
        notes: 'Monthly stipend credited',
        isCategorized: true,
        createdAt: now - day * 12,
        updatedAt: now - day * 12,
      },
      {
        id: 'txn-2',
        amount: 5000,
        type: 'income',
        category: 'Pocket Money / Allowance',
        merchant: 'Dad (UPI Transfer)',
        rawMerchant: 'UPI/PAPA/9823019283@okaxis',
        timestamp: now - day * 8,
        source: 'sms',
        bankOrApp: 'State Bank of India',
        notes: 'Monthly mess allowance',
        isCategorized: true,
        createdAt: now - day * 8,
        updatedAt: now - day * 8,
      },
      {
        id: 'txn-3',
        amount: 8000,
        type: 'savings',
        category: 'Savings & Investments',
        merchant: 'Nifty 50 Index Fund (Groww)',
        rawMerchant: 'UPI/GROWW/groww@icici',
        timestamp: now - day * 7,
        source: 'manual',
        bankOrApp: 'GPay',
        notes: 'Monthly SIP investment',
        isCategorized: true,
        createdAt: now - day * 7,
        updatedAt: now - day * 7,
      },
      {
        id: 'txn-4',
        amount: 150,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Anand Vadapav',
        rawMerchant: 'UPI/ANAND VADAPAV/anand@okhdfcbank/418291029182',
        upiRefId: '418291029182',
        timestamp: now - day * 2 - 3600000 * 3,
        source: 'sms',
        bankOrApp: 'Bank of Maharashtra',
        notes: 'Evening snacks with college friends',
        isCategorized: true,
        createdAt: now - day * 2,
        updatedAt: now - day * 2,
      },
      {
        id: 'txn-5',
        amount: 45,
        type: 'expense',
        category: 'Travel & Transit',
        merchant: 'PMPML Bus Pass',
        rawMerchant: 'UPI/PMPML PUNE/pmpml@sbi/419201928312',
        upiRefId: '419201928312',
        timestamp: now - day * 2 - 3600000 * 5,
        source: 'sms',
        bankOrApp: 'GPay',
        notes: 'Daily commute ticket',
        isCategorized: true,
        createdAt: now - day * 2,
        updatedAt: now - day * 2,
      },
      {
        id: 'txn-6',
        amount: 349,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Swiggy',
        rawMerchant: 'UPI/SWIGGY/swiggy@icici/420192039485',
        upiRefId: '420192039485',
        timestamp: now - day * 1 - 3600000 * 2,
        source: 'sms',
        bankOrApp: 'PhonePe',
        notes: 'Paneer Biryani dinner',
        isCategorized: true,
        createdAt: now - day * 1,
        updatedAt: now - day * 1,
      },
      {
        id: 'txn-7',
        amount: 199,
        type: 'expense',
        category: 'Subscriptions & Gaming',
        merchant: 'Spotify India',
        rawMerchant: 'AUTOPAY/SPOTIFY/129381920391',
        timestamp: now - day * 5,
        source: 'sms',
        bankOrApp: 'HDFC Bank',
        notes: 'Spotify Student Premium',
        isCategorized: true,
        createdAt: now - day * 5,
        updatedAt: now - day * 5,
      },
      {
        id: 'txn-8',
        amount: 1450,
        type: 'expense',
        category: 'Stationery & Education',
        merchant: 'Pragati Book Store',
        rawMerchant: 'UPI/PRAGATI BOOK/pragatibooks@kotak/421092839182',
        upiRefId: '421092839182',
        timestamp: now - day * 4,
        source: 'manual',
        bankOrApp: 'GPay',
        notes: 'Semester reference textbooks',
        isCategorized: true,
        createdAt: now - day * 4,
        updatedAt: now - day * 4,
      },
      {
        id: 'txn-9',
        amount: 220,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Royal Sweet Mart',
        rawMerchant: 'UPI/ROYAL SWEETS/royalsweets@paytm/421192839184',
        upiRefId: '421192839184',
        timestamp: now - 3600000 * 1,
        source: 'sms',
        bankOrApp: 'GPay',
        notes: 'Kaju Katli box',
        isCategorized: false,
        createdAt: now - 3600000 * 1,
        updatedAt: now - 3600000 * 1,
      },
    ];

    await db.transactions.bulkAdd(sampleTransactions);

    // Seed sample savings goals
    const sampleGoals: SavingsGoal[] = [
      {
        id: 'goal-1',
        title: 'MacBook Air M3 Fund',
        targetAmount: 90000,
        currentAmount: 48000,
        deadline: '2027-04-30',
        icon: 'Laptop',
        color: '#06b6d4',
        createdAt: now - day * 30,
      },
      {
        id: 'goal-2',
        title: 'Emergency Rainy Day Fund',
        targetAmount: 30000,
        currentAmount: 22500,
        deadline: '2026-12-31',
        icon: 'ShieldCheck',
        color: '#10b981',
        createdAt: now - day * 60,
      },
      {
        id: 'goal-3',
        title: 'Goa Trip with College Friends',
        targetAmount: 15000,
        currentAmount: 9500,
        deadline: '2026-12-25',
        icon: 'Palmtree',
        color: '#f59e0b',
        createdAt: now - day * 15,
      },
    ];

    await db.savings_goals.bulkAdd(sampleGoals);
  }
}

/**
 * Predict category based on merchant string & saved rules
 */
export async function predictCategory(merchantStr: string): Promise<string | null> {
  if (!merchantStr) return null;
  const normalized = merchantStr.toLowerCase();

  const rules = await db.merchant_rules.toArray();
  for (const rule of rules) {
    if (normalized.includes(rule.keyword.toLowerCase())) {
      const cat = await db.categories.get(rule.categoryId);
      if (cat) return cat.name;
    }
  }

  // Fallback heuristic keyword checks
  if (/vadapav|chai|tea|hotel|cafe|bistro|dhaba|biryani|sweets|bakery|mess|kitchen|canteen/i.test(normalized)) {
    return 'Food & Dining';
  }
  if (/bus|train|railway|auto|cab|metro|petrol|fuel|toll|transport/i.test(normalized)) {
    return 'Travel & Transit';
  }
  if (/book|xerox|print|college|library|exam|academy|tuition/i.test(normalized)) {
    return 'Stationery & Education';
  }
  if (/recharge|bill|electricity|water|wifi|broadband|rent/i.test(normalized)) {
    return 'Rent & Bills';
  }
  if (/game|play|sub|ott|movie|cinema|inox|pvr/i.test(normalized)) {
    return 'Subscriptions & Gaming';
  }
  if (/mutual|fund|sip|gold|deposit|stocks/i.test(normalized)) {
    return 'Savings & Investments';
  }

  return null;
}

/**
 * Learn user categorization and persist as a merchant rule
 */
export async function learnMerchantRule(merchant: string, categoryName: string) {
  if (!merchant || !categoryName) return;
  const normalized = merchant.trim().toLowerCase();
  if (normalized.length < 3) return;

  const categories = await db.categories.toArray();
  const matchedCat = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!matchedCat) return;

  const existing = await db.merchant_rules.where('keyword').equals(normalized).first();
  if (existing) {
    await db.merchant_rules.update(existing.id, {
      categoryId: matchedCat.id,
      confidence: 1.0,
    });
  } else {
    await db.merchant_rules.add({
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      keyword: normalized,
      categoryId: matchedCat.id,
      confidence: 1.0,
      createdAt: Date.now(),
    });
  }
}

/**
 * Settle an IOU
 */
export async function settleIOU(iouId: string, settlementTxnId?: string) {
  await db.ious.update(iouId, {
    status: 'settled',
    settledAt: Date.now(),
    settledViaTxnId: settlementTxnId,
  });
}

/**
 * Check if incoming credit matches any pending IOU
 */
export async function findMatchingPendingIOU(senderOrText: string, amount: number): Promise<IOU | null> {
  const pendingIOUs = await db.ious.where('status').equals('pending').toArray();
  const normalizedText = senderOrText.toLowerCase();

  for (const iou of pendingIOUs) {
    const nameMatch = normalizedText.includes(iou.personName.toLowerCase());
    const amountMatch = Math.abs(iou.amount - amount) < 1.0;

    if (nameMatch && amountMatch) {
      return iou;
    }
  }

  // Also check if amount alone matches a unique pending IOU
  const amountMatches = pendingIOUs.filter((i) => Math.abs(i.amount - amount) < 1.0);
  if (amountMatches.length === 1) {
    return amountMatches[0];
  }

  return null;
}

/**
 * Calculate total active recurring commitments due this month
 */
export async function getMonthlyRecurringCommitments(): Promise<number> {
  const bills = await db.recurring_bills.where('isActive').equals(1).toArray();
  let total = 0;
  for (const b of bills) {
    if (b.billingCycle === 'monthly') {
      total += b.amount;
    } else if (b.billingCycle === 'yearly') {
      total += Math.round(b.amount / 12);
    }
  }
  return total;
}

/**
 * Mark a recurring bill as paid, log transaction, and advance due date by 1 cycle
 */
export async function markBillPaid(billId: string) {
  const bill = await db.recurring_bills.get(billId);
  if (!bill) return;

  // 1. Log transaction
  const newTxnId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.transactions.add({
    id: newTxnId,
    amount: bill.amount,
    type: 'expense',
    category: bill.category,
    merchant: bill.title,
    timestamp: Date.now(),
    source: 'manual',
    notes: `Recurring bill payment (${bill.billingCycle})`,
    isCategorized: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 2. Advance nextDueDate
  const parts = bill.nextDueDate.split('-');
  let y = parseInt(parts[0], 10) || new Date().getFullYear();
  let m = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const d = parts[2] || '01';

  if (bill.billingCycle === 'yearly') {
    y += 1;
  } else {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  const nextDueStr = `${y}-${String(m).padStart(2, '0')}-${d}`;
  await db.recurring_bills.update(billId, {
    nextDueDate: nextDueStr,
  });
}
