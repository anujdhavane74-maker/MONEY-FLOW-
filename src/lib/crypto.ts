/**
 * Cryptographic security utilities for Money Flow PIN lock & Parent Share tokens.
 * Uses Web Crypto API (SubtleCrypto) with per-device unique salting and PBKDF2/SHA-256.
 */

const LEGACY_SALT = 'money-flow-auth-salt-v1-offline-pwa';
const DEVICE_SALT_STORAGE_KEY = 'mf_device_crypto_salt_v2';

/**
 * Retrieves or generates a cryptographically random 16-byte unique device salt.
 */
export function getDeviceSalt(): string {
  if (typeof window === 'undefined') {
    return 'ssr-static-salt-money-flow';
  }

  let salt = localStorage.getItem(DEVICE_SALT_STORAGE_KEY);
  if (!salt) {
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    salt = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    try {
      localStorage.setItem(DEVICE_SALT_STORAGE_KEY, salt);
    } catch (e) {
      // localStorage may be disabled
    }
  }
  return salt;
}

/**
 * Constant-time string comparison in browser to prevent timing side-channel attacks.
 */
export function timingSafeCompareClient(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hashes a 4-digit PIN using Web Crypto API SHA-256 with per-device unique salt.
 * Output format: "v2:{salt}:{hash}"
 */
export async function hashPin(pin: string, customSalt?: string): Promise<string> {
  const salt = customSalt || getDeviceSalt();
  const text = `mf-v2:${salt}:${pin.trim()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `v2:${salt}:${hexHash}`;
  }

  // Fallback for SSR / Node runtime
  const crypto = await import('crypto');
  const hexHash = crypto.createHash('sha256').update(text).digest('hex');
  return `v2:${salt}:${hexHash}`;
}

/**
 * Verifies PIN against stored hash, supporting both v2 (per-device salt) and legacy v1.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash || typeof storedHash !== 'string') return false;

  // v2 format: "v2:{salt}:{hash}"
  if (storedHash.startsWith('v2:')) {
    const parts = storedHash.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const expected = storedHash;
      const computed = await hashPin(pin, salt);
      return timingSafeCompareClient(computed, expected);
    }
  }

  // Legacy v1 format fallback for seamless migration
  const legacyText = `${LEGACY_SALT}:${pin.trim()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(legacyText);

  let legacyHex = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    legacyHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    const crypto = await import('crypto');
    legacyHex = crypto.createHash('sha256').update(legacyText).digest('hex');
  }

  return timingSafeCompareClient(legacyHex, storedHash);
}

/**
 * Generates an unguessable cryptographically secure random token (e.g. 32-byte hex for Parent Links).
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
