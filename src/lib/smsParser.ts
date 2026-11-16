import { ParsedSmsResult, TransactionType } from './types';
import { cleanMerchantName } from './formatters';

export function parseIndianFinancialSms(text: string): ParsedSmsResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { success: false, errorMessage: 'Empty SMS/notification text provided.' };
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();

  // 1. Determine Transaction Type
  let type: TransactionType = 'expense';
  const isDebit = /\b(debited|debit|sent|paid|spent|withdrawn|deducted|payment of)\b/i.test(cleanText);
  const isCredit = /\b(credited|credit|received|deposited|refunded|added to)\b/i.test(cleanText);

  if (isCredit && !isDebit) {
    type = 'income';
  } else if (isDebit) {
    type = 'expense';
  } else {
    // Fallback heuristic
    if (/\b(to|at|for)\b/i.test(cleanText)) {
      type = 'expense';
    } else if (/\b(from|by)\b/i.test(cleanText)) {
      type = 'income';
    }
  }

  // 2. Extract Amount
  // Matches: INR 150.00, Rs. 1,500, Rs 500, ₹220.50, debited by 45.0, etc.
  let amount: number | undefined;
  const amountRegexes = [
    /(?:inr|rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:debited|credited)\s*(?:by|for)?\s*(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:payment of|amount of)\s*(?:inr|rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)/i,
  ];

  for (const rx of amountRegexes) {
    const match = cleanText.match(rx);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '');
      const parsedNum = parseFloat(numStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
        break;
      }
    }
  }

  if (amount === undefined) {
    return {
      success: false,
      rawText: text,
      errorMessage: 'Could not extract valid transaction amount from text.',
    };
  }

  // 3. Extract UPI Reference Number (UTR / Ref ID - usually 12 digits in India)
  let upiRefId: string | undefined;
  const upiRefRegexes = [
    /(?:upi\s*ref(?:erence)?\s*(?:no\.?|id)?|ref\s*no\.?|rrn|utr)[\s/:]*([0-9]{12})\b/i,
    /upi[\s/:]*([0-9]{12})\b/i,
    /\b([0-9]{12})\b/, // 12-digit fallback
  ];

  for (const rx of upiRefRegexes) {
    const match = cleanText.match(rx);
    if (match && match[1]) {
      upiRefId = match[1];
      break;
    }
  }

  // 4. Detect Bank or App
  let bankOrApp = 'Bank Account';
  if (/bank of maharashtra|bom\b/i.test(cleanText)) bankOrApp = 'Bank of Maharashtra';
  else if (/\bhdfc\b/i.test(cleanText)) bankOrApp = 'HDFC Bank';
  else if (/\bsbi\b|state bank/i.test(cleanText)) bankOrApp = 'State Bank of India';
  else if (/\bicici\b/i.test(cleanText)) bankOrApp = 'ICICI Bank';
  else if (/\baxis\b/i.test(cleanText)) bankOrApp = 'Axis Bank';
  else if (/\bkotak\b/i.test(cleanText)) bankOrApp = 'Kotak Mahindra Bank';
  else if (/\bpaytm\b/i.test(cleanText)) bankOrApp = 'Paytm';
  else if (/\bphonepe\b/i.test(cleanText)) bankOrApp = 'PhonePe';
  else if (/\bgoogle pay\b|\bgpay\b/i.test(cleanText)) bankOrApp = 'Google Pay';
  else if (/\bcred\b/i.test(cleanText)) bankOrApp = 'CRED';
  else if (/\bpnb\b/i.test(cleanText)) bankOrApp = 'Punjab National Bank';
  else if (/\bcanara\b/i.test(cleanText)) bankOrApp = 'Canara Bank';

  // 5. Extract Counterparty / Merchant Name
  let merchant = 'Unknown Merchant';
  const merchantRegexes = [
    // "transfer to PMPML BUS Ref No" or "to ANAND VADAPAV"
    /(?:transfer\s+to|paid\s+to|sent\s+to|to\s+vpa|to)\s+([A-Za-z0-9\s.&'-]+?)(?:\s+(?:on|via|ref|upi|avail|bal|\.|\-)|$)/i,
    // "Received from Papa via UPI"
    /(?:received\s+from|from)\s+([A-Za-z0-9\s.&'-]+?)(?:\s+(?:on|via|ref|upi|avail|bal|\.|\-)|$)/i,
    // "by UPI/PAPA/..."
    /(?:by\s+upi\/|upi\/)([A-Za-z0-9\s.&'-]+?)\//i,
    // "at Anand Vadapav"
    /(?:spent\s+at|at)\s+([A-Za-z0-9\s.&'-]+?)(?:\s+(?:on|via|ref|upi|\.|\-)|$)/i,
    // "for Netflix on"
    /(?:for)\s+([A-Za-z0-9\s.&'-]+?)(?:\s+(?:on|via|ref|upi|\.|\-)|$)/i,
  ];

  for (const rx of merchantRegexes) {
    const match = cleanText.match(rx);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Skip if matched word is just "UPI" or account numbers
      if (!/^(upi|a\/c|account|vpa)$/i.test(candidate) && candidate.length > 2) {
        merchant = cleanMerchantName(candidate);
        break;
      }
    }
  }

  // 6. Extract Timestamp (or default to current time)
  let timestamp = Date.now();
  const dateRegex = /\b(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{2,4})\b/;
  const dateMatch = cleanText.match(dateRegex);
  if (dateMatch) {
    try {
      const day = parseInt(dateMatch[1], 10);
      const monthPart = dateMatch[2];
      let year = parseInt(dateMatch[3], 10);
      if (year < 100) year += 2000;

      let month = 0;
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIdx = monthNames.indexOf(monthPart.toLowerCase().slice(0, 3));
      if (monthIdx >= 0) {
        month = monthIdx;
      } else {
        month = parseInt(monthPart, 10) - 1;
      }

      const extractedDate = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(extractedDate.getTime())) {
        timestamp = extractedDate.getTime();
      }
    } catch {
      // Use current time
    }
  }

  return {
    success: true,
    amount,
    type,
    merchant,
    bankOrApp,
    upiRefId,
    timestamp,
    rawText: text,
  };
}
