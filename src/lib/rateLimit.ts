import { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
  lastSeen: number;
}

// Bounded in-memory store to prevent memory leaks under 10k+ concurrent requests
const MAX_IP_STORE_ENTRIES = 10000;
const ipStore = new Map<string, RateLimitRecord>();

// Cleanup stale IP entries
function evictStaleEntries(now: number) {
  for (const [ip, record] of ipStore.entries()) {
    if (now > record.resetAt) {
      ipStore.delete(ip);
    }
  }

  // If still above threshold, perform LRU eviction based on lastSeen
  if (ipStore.size > MAX_IP_STORE_ENTRIES) {
    const sorted = [...ipStore.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    const toRemove = sorted.slice(0, Math.floor(MAX_IP_STORE_ENTRIES * 0.2));
    for (const [ip] of toRemove) {
      ipStore.delete(ip);
    }
  }
}

// Periodic cleanup interval for long-lived processes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    evictStaleEntries(Date.now());
  }, 3 * 60 * 1000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * High-performance sliding-window rate limiter with bounded memory footprint
 * @param req NextRequest
 * @param limit Max requests allowed in window
 * @param windowMs Window duration in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  req: NextRequest,
  limit: number = 30,
  windowMs: number = 60000
): RateLimitResult {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0].trim() || realIp || '127.0.0.1';

  const now = Date.now();

  // Inline opportunistic eviction if store grows past threshold
  if (ipStore.size > MAX_IP_STORE_ENTRIES) {
    evictStaleEntries(now);
  }

  const record = ipStore.get(ip);

  if (!record || now > record.resetAt) {
    ipStore.set(ip, {
      count: 1,
      resetAt: now + windowMs,
      lastSeen: now,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  record.lastSeen = now;

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(record.resetAt / 1000),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil(record.resetAt / 1000),
  };
}
