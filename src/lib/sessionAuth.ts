/**
 * Money Flow Google Pay-Style Persistent Session Auth & WebAuthn Biometrics
 *
 * Provides:
 * 1. Persistent session unlock state across page refreshes, tab switches, and transaction saves.
 * 2. Idle inactivity auto-lock tracking with configurable timeouts (1m / 5m / 15m / Never).
 * 3. WebAuthn platform authenticator (Touch ID, Face ID, Android Fingerprint, Windows Hello).
 */

import { getDeviceSalt } from './crypto';

export const STORAGE_KEY_UNLOCKED_AT = 'mf_unlocked_at';
export const STORAGE_KEY_LAST_ACTIVE = 'mf_last_active';
export const STORAGE_KEY_SESSION_SIG = 'mf_session_sig';
export const STORAGE_KEY_BIOMETRIC_CRED = 'mf_biometric_cred_id';
export const STORAGE_KEY_BIOMETRIC_ENABLED = 'mf_biometric_enabled';

/**
 * Computes a SHA-256 HMAC/hash signature over the unlock timestamp and device salt
 * to prevent manual tampering of sessionStorage / localStorage values.
 */
async function computeSessionSignature(timestamp: number): Promise<string> {
  const salt = getDeviceSalt();
  const raw = `mf-session-v1:${salt}:${timestamp}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const data = new TextEncoder().encode(raw);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return String(timestamp);
}

/**
 * Marks the application session as unlocked (called on valid PIN or Biometric auth).
 * Stores values in both sessionStorage and localStorage for seamless refresh persistence.
 */
export async function setUnlockSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const sig = await computeSessionSignature(now);

  try {
    sessionStorage.setItem(STORAGE_KEY_UNLOCKED_AT, String(now));
    sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    sessionStorage.setItem(STORAGE_KEY_SESSION_SIG, sig);

    localStorage.setItem(STORAGE_KEY_UNLOCKED_AT, String(now));
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    localStorage.setItem(STORAGE_KEY_SESSION_SIG, sig);
  } catch (e) {
    // Fallback for private browsing
  }
}

/**
 * Clears the session unlock tokens, immediately locking the app.
 */
export function clearUnlockSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY_UNLOCKED_AT);
    sessionStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
    sessionStorage.removeItem(STORAGE_KEY_SESSION_SIG);

    localStorage.removeItem(STORAGE_KEY_UNLOCKED_AT);
    localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
    localStorage.removeItem(STORAGE_KEY_SESSION_SIG);
  } catch (e) {
    // Ignore
  }
}

/**
 * Verifies whether the current user session is valid and unlocked.
 * Automatically checks idle timeout expiration according to autoLockMinutes.
 *
 * @param pinEnabled Whether PIN lock is turned on in AppSettings
 * @param autoLockMinutes Configured timeout in minutes (0 means Never on this device)
 */
export async function isSessionUnlocked(
  pinEnabled: boolean,
  autoLockMinutes: number = 5
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!pinEnabled) return true;

  try {
    const unlockedAtStr =
      sessionStorage.getItem(STORAGE_KEY_UNLOCKED_AT) ||
      localStorage.getItem(STORAGE_KEY_UNLOCKED_AT);
    const sig =
      sessionStorage.getItem(STORAGE_KEY_SESSION_SIG) ||
      localStorage.getItem(STORAGE_KEY_SESSION_SIG);
    const lastActiveStr =
      sessionStorage.getItem(STORAGE_KEY_LAST_ACTIVE) ||
      localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);

    if (!unlockedAtStr || !sig) {
      return false;
    }

    const unlockedAt = Number(unlockedAtStr);
    if (isNaN(unlockedAt) || unlockedAt <= 0) {
      clearUnlockSession();
      return false;
    }

    // Verify session token integrity
    const expectedSig = await computeSessionSignature(unlockedAt);
    if (sig !== expectedSig) {
      clearUnlockSession();
      return false;
    }

    // "0" or negative means "Never on this device" (manual lock only)
    if (autoLockMinutes <= 0) {
      return true;
    }

    const lastActive = Number(lastActiveStr) || unlockedAt;
    const now = Date.now();
    const timeoutMs = autoLockMinutes * 60 * 1000;

    if (now - lastActive > timeoutMs) {
      clearUnlockSession();
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

let lastActiveWrite = 0;
/**
 * Throttled activity heartbeat recorder.
 * Updates the last active timestamp on pointer, touch, scroll, and keydown events.
 */
export function recordUserActivity(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastActiveWrite < 2500) return;
  lastActiveWrite = now;

  try {
    const unlockedAt =
      sessionStorage.getItem(STORAGE_KEY_UNLOCKED_AT) ||
      localStorage.getItem(STORAGE_KEY_UNLOCKED_AT);
    if (unlockedAt) {
      sessionStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    }
  } catch (e) {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// WebAuthn Biometric Authentication (Touch ID / Face ID / Android Fingerprint)
// -----------------------------------------------------------------------------

/**
 * Checks if platform biometrics (Touch ID, Face ID, Android Biometrics) are supported.
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;
  if (
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
    'function'
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Checks whether the user has enrolled their biometric hardware for Money Flow.
 */
export function isBiometricEnrolled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isEnabled = localStorage.getItem(STORAGE_KEY_BIOMETRIC_ENABLED);
    const credId = localStorage.getItem(STORAGE_KEY_BIOMETRIC_CRED);
    return Boolean(isEnabled === 'true' && credId);
  } catch {
    return false;
  }
}

/**
 * Enrolls device biometric credential via navigator.credentials.create.
 */
export async function enrollBiometrics(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window not found' };
  const supported = await isBiometricsSupported();
  if (!supported) {
    return { success: false, error: 'Biometric hardware is not available on this device' };
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const host = window.location.hostname;
    const rpId = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ? undefined : host;

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Money Flow Vault',
          ...(rpId ? { id: rpId } : {}),
        },
        user: {
          id: new TextEncoder().encode('money-flow-owner'),
          name: 'owner@moneyflow.app',
          displayName: 'Money Flow Owner',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (credential && credential.id) {
      localStorage.setItem(STORAGE_KEY_BIOMETRIC_CRED, credential.id);
      localStorage.setItem(STORAGE_KEY_BIOMETRIC_ENABLED, 'true');
      return { success: true };
    }
    return { success: false, error: 'Failed to generate credential' };
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric authentication was cancelled.' };
    }
    return { success: false, error: err.message || 'Biometric enrollment failed' };
  }
}

/**
 * Disables biometric unlock on this device.
 */
export function disableBiometrics(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_BIOMETRIC_CRED);
    localStorage.removeItem(STORAGE_KEY_BIOMETRIC_ENABLED);
  } catch {
    // Ignore
  }
}

/**
 * Prompts the user with platform biometrics (Touch ID / Face ID / Fingerprint).
 * On success, automatically establishes an unlocked session.
 */
export async function authenticateWithBiometrics(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window not found' };
  const supported = await isBiometricsSupported();
  if (!supported) {
    return { success: false, error: 'Biometric hardware unavailable' };
  }

  const credId = localStorage.getItem(STORAGE_KEY_BIOMETRIC_CRED);
  const host = window.location.hostname;
  const rpId = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) ? undefined : host;
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  try {
    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (credId) {
      try {
        const raw = atob(credId.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        allowCredentials.push({
          id: bytes,
          type: 'public-key',
        });
      } catch {
        allowCredentials.push({
          id: new TextEncoder().encode(credId),
          type: 'public-key',
        });
      }
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        ...(rpId ? { rpId } : {}),
        userVerification: 'required',
        timeout: 60000,
        ...(allowCredentials.length > 0 ? { allowCredentials } : {}),
      },
    });

    if (assertion) {
      await setUnlockSession();
      return { success: true };
    }
    return { success: false, error: 'Biometric verification unsuccessful' };
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometric check cancelled. Enter your PIN.' };
    }
    return { success: false, error: err.message || 'Biometric check failed' };
  }
}
