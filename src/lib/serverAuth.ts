import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from './supabase';

/**
 * Timing-safe string comparison to prevent timing attacks on API keys and tokens.
 */
export function timingSafeEqualString(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');

  if (bufA.length !== bufB.length) {
    // Perform dummy comparison of equal length to consume constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Retrieves the server-side authorized webhook secret from environment variables.
 * Falls back to MONEY_FLOW_API_KEY if INGEST_WEBHOOK_SECRET is unset.
 */
export function getAuthorizedWebhookSecret(): string | null {
  const secret = process.env.INGEST_WEBHOOK_SECRET || process.env.MONEY_FLOW_API_KEY;
  if (!secret || secret.trim().length === 0) {
    return null;
  }
  return secret.trim();
}

/**
 * Verifies optional HMAC-SHA256 signature on webhook payloads (e.g., from MacroDroid or external gateways).
 */
export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const cleanSig = signatureHeader.replace(/^sha256=/, '').trim();
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  return timingSafeEqualString(cleanSig, expectedSig);
}

/**
 * Authenticates an incoming NextRequest using per-user Supabase API keys with fallback to server secret.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  rawBody?: string
): Promise<{ authorized: boolean; userId?: string; reason?: string }> {
  // 1. Extract API key from Authorization header, X-API-Key, or query param
  const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key');
  const { searchParams } = new URL(req.url);
  const queryKey = searchParams.get('apiKey');

  let clientKey = authHeader || queryKey;
  if (clientKey) {
    clientKey = clientKey.replace(/^Bearer\s+/i, '').trim();
  }

  // 2. Check per-user API keys in Supabase (Multi-tenant routing)
  const supabase = getServiceSupabase();
  if (supabase && clientKey) {
    try {
      // Check user_api_keys table
      const { data: keyRecord } = await supabase
        .from('user_api_keys')
        .select('user_id')
        .eq('api_key', clientKey)
        .eq('is_active', true)
        .maybeSingle();

      if (keyRecord && keyRecord.user_id) {
        return { authorized: true, userId: keyRecord.user_id };
      }

      // Check app_settings table
      const { data: settingsRecord } = await supabase
        .from('app_settings')
        .select('user_id')
        .eq('api_key', clientKey)
        .maybeSingle();

      if (settingsRecord && settingsRecord.user_id) {
        return { authorized: true, userId: settingsRecord.user_id };
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Per-user API key lookup warning:', err);
      }
    }
  }

  // 3. Fallback: Check server-level webhook secret for single-tenant / demo usage
  const secret = getAuthorizedWebhookSecret();
  if (secret) {
    // Check HMAC signature if provided
    const hmacHeader =
      req.headers.get('x-signature-sha256') ||
      req.headers.get('x-hub-signature-256') ||
      req.headers.get('x-webhook-signature');

    if (hmacHeader && rawBody) {
      if (verifyHmacSignature(rawBody, hmacHeader, secret)) {
        return { authorized: true, userId: 'default-owner' };
      }
    }

    if (clientKey && timingSafeEqualString(clientKey, secret)) {
      return { authorized: true, userId: 'default-owner' };
    }
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Invalid or missing authentication credentials.',
  };
}

/**
 * Strict CORS origin verification. Restricts Access-Control-Allow-Origin to authorized app domains.
 */
export function getSafeCorsHeaders(req: NextRequest): Record<string, string> {
  const requestOrigin = req.headers.get('origin');
  const allowedUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  let allowedOrigin = '';

  if (requestOrigin) {
    // If NEXT_PUBLIC_APP_URL is set, match against it
    if (allowedUrl && (requestOrigin === allowedUrl || requestOrigin === allowedUrl.replace(/\/$/, ''))) {
      allowedOrigin = requestOrigin;
    } else {
      // Allow localhost in development
      const isLocalhost =
        requestOrigin.startsWith('http://localhost:') ||
        requestOrigin.startsWith('http://127.0.0.1:');
      if (isLocalhost) {
        allowedOrigin = requestOrigin;
      }
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin || (allowedUrl || 'null'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, X-Signature-SHA256',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
