/**
 * Money Flow Formatting Utilities
 * Adheres strictly to Indian Numbering System (Lakhs & Crores) and Asia/Kolkata IST
 */

export function formatINR(amount: number, showSign: boolean = false): string {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absVal);

  if (showSign) {
    return isNegative ? `-${formatted}` : `+${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

export function formatIndianCompact(amount: number): string {
  const absVal = Math.abs(amount);
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
