/**
 * Money Flow — NPCI Standard UPI QR Payload Parser & Deep-Link Generator
 * Adheres to NPCI UPI Specifications (v1.6+)
 */

export interface ParsedUpiPayload {
  isValid: boolean;
  errorMessage?: string;
  rawText: string;
  payeeAddress: string; // pa (VPA, e.g., merchant@okhdfcbank)
  payeeName: string; // pn (Merchant / Friend Name)
  amount?: number; // am (Fixed or suggested amount)
  currency: string; // cu (Defaults to INR)
  merchantCode?: string; // mc (MCC Code, e.g., 5812 for Dining)
  transactionNote?: string; // tn
  transactionId?: string; // tid
  transactionRef?: string; // tr
  suggestedCategory: string; // Auto-detected from MCC or merchant keywords
}

/**
 * Common NPCI Merchant Category Codes (MCC) to Money Flow Category mapping
 */
const MCC_CATEGORY_MAP: Record<string, string> = {
  // Food & Dining / Restaurants / Caterers / Bakeries
  '5811': 'Food & Dining',
  '5812': 'Food & Dining',
  '5813': 'Food & Dining',
  '5814': 'Food & Dining', // Fast Food Restaurants
  '5462': 'Food & Dining', // Bakeries
  '5499': 'Food & Dining', // Miscellaneous Food Stores
  '5815': 'Food & Dining',

  // Groceries & Retail Shopping
  '5411': 'Shopping', // Grocery Stores, Supermarkets
  '5422': 'Shopping', // Meat / Fish
  '5441': 'Shopping', // Candy, Nut, Confectionery
  '5451': 'Shopping', // Dairy Products
  '5311': 'Shopping', // Department Stores
  '5331': 'Shopping', // Variety Stores
  '5399': 'Shopping', // Misc General Merchandise
  '5651': 'Shopping', // Family Clothing
  '5691': 'Shopping', // Men & Women Clothing
  '5912': 'Shopping', // Drug Stores / Pharmacies
  '5944': 'Shopping', // Jewelry
  '5977': 'Shopping', // Cosmetic Stores

  // Travel, Transit & Fuel
  '4121': 'Travel & Transit', // Taxicabs, Limousines, Auto-rickshaws
  '4111': 'Travel & Transit', // Local Commuter Transport, Ferries
  '4112': 'Travel & Transit', // Passenger Railways
  '4131': 'Travel & Transit', // Bus Lines
  '5541': 'Travel & Transit', // Service Stations (Fuel / Gas)
  '5542': 'Travel & Transit', // Automated Fuel Dispensers
  '4784': 'Travel & Transit', // Tolls and Bridge Fees
  '7523': 'Travel & Transit', // Parking Lots & Garages

  // Education & Stationery
  '8211': 'Stationery & Education', // Elementary & Secondary Schools
  '8220': 'Stationery & Education', // Colleges & Universities
  '8299': 'Stationery & Education', // Educational Services
  '5942': 'Stationery & Education', // Book Stores
  '5943': 'Stationery & Education', // Stationery Stores

  // Rent & Utilities
  '4900': 'Rent & Bills', // Electric, Gas, Water
  '4814': 'Rent & Bills', // Telecommunications / Cell Recharges
  '4899': 'Rent & Bills', // Cable & Pay TV

  // Entertainment & Gaming
  '7832': 'Subscriptions & Gaming', // Motion Picture Theaters
  '7993': 'Subscriptions & Gaming', // Video Amusement Games
  '7994': 'Subscriptions & Gaming', // Video Game Arcades
};

/**
 * Keyword-based category classification
 */
export function detectCategoryFromMerchant(name: string, upiId: string = ''): string {
  const text = `${name.toLowerCase()} ${upiId.toLowerCase()}`;

  // 1. Food & Dining
  if (
    /(chai|tea|coffee|vadapav|swiggy|zomato|mcdonald|burger|pizza|bakery|dhaba|restaurant|cafe|hotel|bistro|kitchen|sweets|fast\s?food|canteen|tiffin|starbucks|barbeque|biryani|amul|juice|shawarma|idli|dosa|mess|paratha|chaat|panipuri|ice\s?cream|waffle|subway|domino|kfc)/i.test(
      text
    )
  ) {
    return 'Food & Dining';
  }

  // 2. Travel & Transit
  if (
    /(auto|taxi|ola|uber|rapido|metro|petrol|fuel|diesel|indianoil|hpcl|bpcl|shell|parking|toll|irctc|railway|bus|pmpml|fastag|cng|gas\s?station|redbus|flight|indigo)/i.test(
      text
    )
  ) {
    return 'Travel & Transit';
  }

  // 3. Groceries & Shopping
  if (
    /(kirana|store|mart|supermarket|bazaar|provision|vegetable|fruits|chemist|pharmacy|medical|groceries|zepto|blinkit|instamart|amazon|flipkart|retail|d-mart|dmart|reliance|trends|zudio|nykaa|myntra|clothes|apparel|footwear|mall)/i.test(
      text
    )
  ) {
    return 'Shopping';
  }

  // 4. Rent & Utility Bills
  if (
    /(electricity|broadband|wifi|airtel|jio|vi\s?bill|water|cylinder|society|maintenance|recharge|dth|tata\s?play|bescom|mseb|adani\s?elec|torent)/i.test(
      text
    )
  ) {
    return 'Rent & Bills';
  }

  // 5. Stationery & Education
  if (
    /(xerox|stationery|print|cyber|books|college|school|tuition|exam|academy|classes|university|library|coaching)/i.test(
      text
    )
  ) {
    return 'Stationery & Education';
  }

  // 6. Subscriptions & Gaming
  if (
    /(netflix|spotify|prime|gaming|playstation|steam|xbox|pvr|inox|cinepolis|theatre|cinema|multiplex)/i.test(
      text
    )
  ) {
    return 'Subscriptions & Gaming';
  }

  // Default fallback for daily quick spends
  return 'Food & Dining';
}

/**
 * Format raw merchant string into a human-readable name
 */
export function cleanMerchantName(rawName: string, vpa: string): string {
  if (rawName && rawName.trim().length > 0) {
    // Replace URL pluses, remove junk prefix/suffixes
    const cleaned = rawName
      .replace(/\+/g, ' ')
      .replace(/%20/g, ' ')
      .replace(/[_\-]+/g, ' ')
      .trim();

    // Capitalize words
    return cleaned
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Fallback: derive name from VPA prefix (e.g. "sharma.tea@paytm" -> "Sharma Tea")
  const prefix = vpa.split('@')[0] || 'Merchant';
  return prefix
    .replace(/[._\-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse standard NPCI UPI QR string or raw VPA
 */
export function parseUpiQrPayload(text: string): ParsedUpiPayload {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      isValid: false,
      errorMessage: 'QR code is empty',
      rawText: '',
      payeeAddress: '',
      payeeName: '',
      currency: 'INR',
      suggestedCategory: 'Food & Dining',
    };
  }

  // Standard NPCI URI Scheme: upi://pay?pa=...
  if (trimmed.toLowerCase().startsWith('upi://pay') || trimmed.includes('pa=')) {
    try {
      const queryString = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed;
      const params = new URLSearchParams(queryString);

      const pa = (params.get('pa') || '').trim();
      let rawPn = params.get('pn') || '';
      try {
        rawPn = decodeURIComponent(rawPn);
      } catch {
        // use raw if decoding fails
      }

      const amStr = params.get('am');
      const am = amStr ? parseFloat(amStr) : undefined;
      const cu = params.get('cu') || 'INR';
      const mc = params.get('mc') || undefined;
      const tn = params.get('tn') || undefined;
      const tid = params.get('tid') || undefined;
      const tr = params.get('tr') || undefined;

      // Validate VPA format (must contain @)
      if (!pa || !pa.includes('@')) {
        return {
          isValid: false,
          errorMessage: 'Scanned QR does not contain a valid UPI VPA address',
          rawText: trimmed,
          payeeAddress: pa,
          payeeName: rawPn,
          currency: cu,
          suggestedCategory: 'Food & Dining',
        };
      }

      const formattedName = cleanMerchantName(rawPn, pa);
      const suggestedCat = mc && MCC_CATEGORY_MAP[mc]
        ? MCC_CATEGORY_MAP[mc]
        : detectCategoryFromMerchant(formattedName, pa);

      return {
        isValid: true,
        rawText: trimmed,
        payeeAddress: pa,
        payeeName: formattedName,
        amount: !isNaN(am as number) && (am as number) > 0 ? am : undefined,
        currency: cu,
        merchantCode: mc,
        transactionNote: tn,
        transactionId: tid,
        transactionRef: tr,
        suggestedCategory: suggestedCat,
      };
    } catch (err) {
      return {
        isValid: false,
        errorMessage: 'Failed to parse UPI QR query parameters',
        rawText: trimmed,
        payeeAddress: '',
        payeeName: '',
        currency: 'INR',
        suggestedCategory: 'Food & Dining',
      };
    }
  }

  // Raw VPA Address Format: e.g. "sharma.tea@paytm" or "9823019283@ybl"
  if (trimmed.includes('@') && !trimmed.includes(' ') && trimmed.length >= 5) {
    const formattedName = cleanMerchantName('', trimmed);
    const suggestedCat = detectCategoryFromMerchant(formattedName, trimmed);

    return {
      isValid: true,
      rawText: trimmed,
      payeeAddress: trimmed,
      payeeName: formattedName,
      currency: 'INR',
      suggestedCategory: suggestedCat,
    };
  }

  return {
    isValid: false,
    errorMessage: 'Scanned code is not a valid UPI payment QR code',
    rawText: trimmed,
    payeeAddress: '',
    payeeName: '',
    currency: 'INR',
    suggestedCategory: 'Food & Dining',
  };
}

/**
 * Builds compliant NPCI UPI deep link for Android/iOS native app dispatch
 */
export function buildUpiDeepLink({
  payeeAddress,
  payeeName,
  amount,
  note = 'Paid via Money Flow',
}: {
  payeeAddress: string;
  payeeName: string;
  amount: number;
  note?: string;
}): string {
  const cleanAmount = amount.toFixed(2);
  const params = new URLSearchParams({
    pa: payeeAddress,
    pn: payeeName,
    am: cleanAmount,
    cu: 'INR',
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}
