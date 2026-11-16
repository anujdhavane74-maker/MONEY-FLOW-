/**
 * Money Flow Global Fintech Formatting Utilities
 * Supports Multi-Currency Engine (INR ₹, USD $, EUR €, GBP £, AED د.إ, SGD S$, JPY ¥)
 * Uses native Intl.NumberFormat and DateTimeFormat with zero bundle bloat.
 */

export interface CurrencyProfile {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  flag: string;
}

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'JPY';

export const SUPPORTED_CURRENCIES: Record<string, CurrencyProfile> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', flag: '🇮🇳' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', flag: '🇺🇸' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', flag: '🇪🇺' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', flag: '🇬🇧' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE', flag: '🇦🇪' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', flag: '🇸🇬' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', flag: '🇯🇵' },
};

export const CURRENCY_LIST: CurrencyProfile[] = Object.values(SUPPORTED_CURRENCIES);

let activeCurrencyCode = 'INR';

export function setActiveCurrency(currency: string) {
  if (SUPPORTED_CURRENCIES[currency]) {
    activeCurrencyCode = currency;
  }
}

export function getActiveCurrency(): CurrencyProfile {
  return SUPPORTED_CURRENCIES[activeCurrencyCode] || SUPPORTED_CURRENCIES.INR;
}

/**
 * Universal Currency Formatter adhering to Intl.NumberFormat and chosen currency locale.
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string,
  showSign: boolean = false
): string {
  const code = currencyCode || activeCurrencyCode || 'INR';
  const profile = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.INR;
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);

  try {
    const formatted = new Intl.NumberFormat(profile.locale, {
      style: 'currency',
      currency: profile.code,
      minimumFractionDigits: profile.code === 'JPY' ? 0 : 0,
      maximumFractionDigits: profile.code === 'JPY' ? 0 : 2,
    }).format(absVal);

    if (showSign) {
      return isNegative ? `-${formatted}` : `+${formatted}`;
    }
    return isNegative ? `-${formatted}` : formatted;
  } catch {
    return `${profile.symbol}${absVal.toLocaleString()}`;
  }
}

/**
 * Backwards-compatible alias for formatCurrency (defaults to active user currency).
 */
export function formatINR(amount: number, showSign: boolean = false): string {
  return formatCurrency(amount, activeCurrencyCode, showSign);
}

export function formatIndianCompact(amount: number): string {
  const absVal = Math.abs(amount);
  const profile = getActiveCurrency();

  if (profile.code === 'INR') {
    if (absVal >= 10000000) {
      return `₹${(absVal / 10000000).toFixed(2)} Cr`;
    }
    if (absVal >= 100000) {
      return `₹${(absVal / 100000).toFixed(2)} L`;
    }
    if (absVal >= 1000) {
      return `₹${(absVal / 1000).toFixed(1)}k`;
    }
    return formatINR(amount);
  }

  // Western compact formatting for USD/EUR/GBP etc.
  if (absVal >= 1000000000) {
    return `${profile.symbol}${(absVal / 1000000000).toFixed(2)}B`;
  }
  if (absVal >= 1000000) {
    return `${profile.symbol}${(absVal / 1000000).toFixed(2)}M`;
  }
  if (absVal >= 1000) {
    return `${profile.symbol}${(absVal / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount, profile.code);
}

export function formatISTDate(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatISTTime(timestamp: number | string | Date): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

export function formatRelativeIST(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  const isToday =
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear();

  if (isToday) {
    return `Today at ${formatISTTime(timestamp)}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear();

  if (isYesterday) {
    return `Yesterday at ${formatISTTime(timestamp)}`;
  }

  return `${formatISTDate(timestamp)} • ${formatISTTime(timestamp)}`;
}

export function cleanMerchantName(raw: string): string {
  if (!raw) return 'Unknown Counterparty';
  let cleaned = raw.trim();

  // Strip common UPI prefixes & noise
  cleaned = cleaned.replace(/^(UPI\/|UPI-|REF\/|TRANSFER TO |PAID TO |RECEIVED FROM )/i, '');
  cleaned = cleaned.replace(/(\/.*?)$/, ''); // Strip after slash if ref
  cleaned = cleaned.replace(/@\w+$/, ''); // Strip VPA domain e.g. @okaxis
  cleaned = cleaned.replace(/[_\-*]/g, ' ');

  // Clean trailing transaction codes & punctuation
  cleaned = cleaned.replace(/\b\d{10,14}\b/g, '').trim();
  cleaned = cleaned.replace(/^[.\s,:-]+|[.\s,:-]+$/g, '').trim();

  // Title case
  if (cleaned.length > 0) {
    return cleaned
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return raw.slice(0, 30);
}
