import { NextRequest, NextResponse } from 'next/server';
import { getServerSnapshot } from '@/lib/serverQueue';
import { getServiceSupabase } from '@/lib/supabase';
import { Transaction } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';
import { timingSafeEqualString, getSafeCorsHeaders } from '@/lib/serverAuth';

export async function OPTIONS(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);

  try {
    // 1. Rate Limiting (Strict 15 requests/minute per IP to prevent token brute-forcing)
    const rateCheck = checkRateLimit(req, 15, 60000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    // Token must be a non-empty string with bounded length
    if (!token || typeof token !== 'string' || token.length < 8 || token.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Invalid parent access token provided.' },
        { status: 400, headers: corsHeaders }
      );
    }

    let isAuthorized = false;
    let tokenLabel = 'Guardian View';
    let hideNotes = false;
    let transactions: Transaction[] = [];

    // 2. Check Demo Token (using timingSafeEqualString)
    if (timingSafeEqualString(token, 'demo-parent-guardian-2026')) {
      isAuthorized = true;
      tokenLabel = 'Demo Guardian Access';
    }

    // 3. Check Supabase
    const supabase = getServiceSupabase();
    if (supabase) {
      try {
        const { data: tokenRows } = await supabase
          .from('parent_share_tokens')
          .select('token, user_id, label, revoked')
          .eq('revoked', false);

        let tokenUserId: string | null = null;
        if (tokenRows && Array.isArray(tokenRows)) {
          for (const row of tokenRows) {
            if (timingSafeEqualString(row.token, token)) {
              isAuthorized = true;
              tokenLabel = row.label || 'Guardian View';
              tokenUserId = row.user_id || null;
              break;
            }
          }
        }

        if (isAuthorized) {
          // Get privacy setting
          let settingsQuery = supabase
            .from('app_settings')
            .select('hide_notes_from_parent');

          if (tokenUserId) {
            settingsQuery = settingsQuery.eq('user_id', tokenUserId);
          } else {
            settingsQuery = settingsQuery.eq('id', 'global');
          }

          const { data: settingsData } = await settingsQuery.maybeSingle();

          if (settingsData) {
            hideNotes = Boolean(settingsData.hide_notes_from_parent);
          }

          // Fetch transactions
          let txQuery = supabase
            .from('transactions')
            .select('*')
            .order('timestamp', { ascending: false });

          if (tokenUserId) {
            txQuery = txQuery.eq('user_id', tokenUserId);
          }

          const { data: txData } = await txQuery;

          if (txData && Array.isArray(txData)) {
            transactions = txData.map((row: any) => ({
              id: row.id,
              amount: Number(row.amount),
              type: row.type,
              category: row.category,
              merchant: row.merchant,
              rawMerchant: row.raw_merchant,
              bankOrApp: row.bank_or_app,
              upiRefId: row.upi_ref_id,
              timestamp: Number(row.timestamp),
              source: row.source,
              notes: row.notes,
              isCategorized: Boolean(row.is_categorized),
              isSplit: Boolean(row.is_split),
              splitTotalAmount: row.split_total_amount ? Number(row.split_total_amount) : undefined,
              myShareAmount: row.my_share_amount ? Number(row.my_share_amount) : undefined,
              createdAt: new Date(row.created_at).getTime(),
              updatedAt: new Date(row.updated_at).getTime(),
            }));
          }
        }
      } catch (sbErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Supabase token verification check error:', sbErr);
        }
      }
    }

    // 4. Fallback to Server Snapshot (Timing-safe comparison)
    if (!isAuthorized) {
      const snapshot = getServerSnapshot();
      if (snapshot && Array.isArray(snapshot.parentShareTokens)) {
        for (const t of snapshot.parentShareTokens) {
          if (!t.revoked && timingSafeEqualString(t.token, token)) {
            isAuthorized = true;
            tokenLabel = t.label || 'Guardian View';
            hideNotes = Boolean(snapshot.settings?.hideNotesFromParent);
            transactions = snapshot.transactions || [];
            break;
          }
        }
      }
    }

    // 5. Unauthorized / Revoked
    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Link Invalid, Expired, or Revoked by Owner.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 6. Strict Data Sanitization:
    // NEVER expose PIN hashes, user API keys, or raw settings in parent view props.
    // Critical Accounting Rule: For expenses, only report the owner's personal share (myShareAmount ?? amount).
    const sanitizedTransactions = transactions.map((t) => {
      const displayAmount =
        t.type === 'expense' && t.myShareAmount != null ? t.myShareAmount : t.amount;

      return {
        id: t.id,
        amount: displayAmount,
        originalTotal: t.splitTotalAmount || t.amount,
        isSplit: Boolean(t.isSplit),
        type: t.type,
        category: t.category,
        merchant: t.merchant,
        bankOrApp: t.bankOrApp,
        upiRefId: t.upiRefId,
        timestamp: t.timestamp,
        notes: hideNotes ? null : t.notes,
        isPrivateNoteHidden: hideNotes && Boolean(t.notes),
      };
    });

    return NextResponse.json(
      {
        success: true,
        tokenLabel,
        hideNotes,
        transactions: sanitizedTransactions,
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
        },
      }
    );
  } catch (error: unknown) {
    const isProd = process.env.NODE_ENV === 'production';
    const msg = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Share data error');
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}
