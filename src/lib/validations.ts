import { z } from 'zod';

/**
 * Strips script tags, HTML tags, and dangerous control characters to prevent XSS.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

/**
 * Neutralizes CSV Formula Injection (DDE attack) where cells beginning with
 * '=', '+', '-', '@', '\t', or '\r' can execute commands in Excel/Sheets.
 */
export function sanitizeForCsv(value: unknown): string {
  const str = String(value ?? '').trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// 1. Ingest SMS Webhook Schema
export const smsIngestSchema = z.object({
  text: z
    .string()
    .min(1, 'SMS or notification text cannot be empty')
    .max(2000, 'Payload text exceeds maximum allowed length of 2000 characters')
    .transform(sanitizeString),
  apiKey: z.string().max(128).optional(),
});

// 2. Transaction Validation Schema
export const transactionSchema = z.object({
  id: z.string().min(1).max(100),
  amount: z.number().positive('Amount must be positive').max(100000000, 'Amount exceeds upper limit'),
  type: z.enum(['income', 'expense', 'savings']),
  category: z.string().min(1).max(100).transform(sanitizeString),
  merchant: z.string().min(1).max(150).transform(sanitizeString),
  rawMerchant: z.string().max(255).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  bankOrApp: z.string().max(100).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  upiRefId: z.string().max(100).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  timestamp: z.number().int().positive(),
  source: z.enum(['manual', 'sms', 'gpay_csv', 'gpay_pdf', 'webhook']),
  notes: z.string().max(500).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  isCategorized: z.boolean(),
  isSplit: z.boolean().optional(),
  splitTotalAmount: z.number().positive().optional(),
  myShareAmount: z.number().positive().optional(),
  splitFriends: z
    .array(
      z.object({
        name: z.string().max(100).transform(sanitizeString),
        amount: z.number().positive(),
        settled: z.boolean(),
      })
    )
    .optional(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

// 3. Sync Push Payload Schema
export const syncPayloadSchema = z.object({
  transactions: z.array(transactionSchema).max(2000, 'Cannot sync more than 2000 transactions at once'),
  categories: z.array(z.any()).optional(),
  parentShareTokens: z
    .array(
      z.object({
        token: z.string().min(16).max(128),
        label: z.string().min(1).max(100).transform(sanitizeString),
        revoked: z.boolean(),
        createdAt: z.number().optional(),
      })
    )
    .optional(),
  settings: z
    .object({
      monthlyBudget: z.number().positive().max(100000000).optional(),
      fixedRecurringBills: z.number().nonnegative().optional(),
      hideNotesFromParent: z.boolean().optional(),
      apiKey: z.string().max(128).optional(),
    })
    .optional(),
  recurringBills: z
    .array(
      z.object({
        id: z.string().max(100),
        title: z.string().max(100).transform(sanitizeString),
        amount: z.number().positive(),
        category: z.string().max(100).transform(sanitizeString),
        billingCycle: z.enum(['monthly', 'yearly']),
        nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
        autoPay: z.boolean(),
        isActive: z.boolean(),
        createdAt: z.number().optional(),
      })
    )
    .optional(),
  ious: z
    .array(
      z.object({
        id: z.string().max(100),
        transactionId: z.string().max(100).optional().nullable(),
        personName: z.string().min(1).max(100).transform(sanitizeString),
        amount: z.number().positive(),
        status: z.enum(['pending', 'settled']),
        description: z.string().max(250).transform(sanitizeString),
        createdAt: z.number().optional(),
        settledAt: z.number().optional().nullable(),
      })
    )
    .optional(),
});

// 4. Manual Transaction Input Form Schema
export const manualExpenseInputSchema = z.object({
  amount: z.number().positive('Please enter an amount greater than 0').max(10000000),
  type: z.enum(['income', 'expense', 'savings']),
  category: z.string().min(1, 'Category is required').max(100).transform(sanitizeString),
  merchant: z.string().min(1, 'Merchant/Description is required').max(150).transform(sanitizeString),
  notes: z.string().max(500).optional().transform((val) => (val ? sanitizeString(val) : '')),
  isSplit: z.boolean().optional(),
  myShareAmount: z.number().positive().optional(),
  friendName: z.string().max(100).optional().transform((val) => (val ? sanitizeString(val) : '')),
});
