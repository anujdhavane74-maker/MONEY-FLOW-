import { NextRequest, NextResponse } from 'next/server';
import {
  getUnsyncedTransactions,
  markTransactionsSynced,
  setServerSnapshot,
} from '@/lib/serverQueue';
import { getServiceSupabase } from '@/lib/supabase';
import { Transaction } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';
import { authenticateApiRequest, getSafeCorsHeaders } from '@/lib/serverAuth';
import { syncPayloadSchema } from '@/lib/validations';

export async function OPTIONS(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);

  try {
    // 1. Rate Limiting (30 req / min)
    const rateCheck = checkRateLimit(req, 30, 60000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } }
      );
    }

    // 2. Authentication Check (Timing-Safe)
    const authResult = authenticateApiRequest(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.reason || 'Unauthorized access.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { searchParams } = new URL(req.url);
    const ack = searchParams.get('ack');
    const idsParam = searchParams.get('ids');

    // If client is acknowledging receipt of synced transactions
    if (ack === 'true' && idsParam) {
      const ids = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 100);

      markTransactionsSynced(ids);

      const supabase = getServiceSupabase();
      if (supabase && ids.length > 0) {
        try {
          await supabase.from('webhook_queue').update({ synced: true }).in('id', ids);
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('Failed to update Supabase queue ack:', err);
          }
        }
      }

      return NextResponse.json(
        { success: true, acknowledged: ids },
        { status: 200, headers: corsHeaders }
      );
    }

    // Retrieve pending transactions
    const memoryQueue = getUnsyncedTransactions();
    const pending: Transaction[] = [...memoryQueue];

    const supabase = getServiceSupabase();
    if (supabase) {
      try {
        const { data } = await supabase
          .from('webhook_queue')
          .select('payload')
          .eq('synced', false)
          .limit(100);

        if (data && Array.isArray(data)) {
          const fromSupabase = data.map((row) => row.payload as Transaction);
          const existingIds = new Set(pending.map((t) => t.id));
          for (const item of fromSupabase) {
            if (!existingIds.has(item.id)) {
              pending.push(item);
              existingIds.add(item.id);
            }
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Supabase queue fetch warning:', err);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        pendingTransactions: pending,
        count: pending.length,
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
    const msg = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Sync fetch failed');
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);

  try {
    // 1. Rate Limiting (30 req / min)
    const rateCheck = checkRateLimit(req, 30, 60000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } }
      );
    }

    // 2. Authentication Check (Timing-Safe)
    const authResult = authenticateApiRequest(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.reason || 'Unauthorized access.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Strict Payload Validation (Zod)
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders });
    }

    const parseResult = syncPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.error.issues[0]?.message || 'Sync payload schema validation failed.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { transactions, categories, parentShareTokens, settings, recurringBills, ious } = parseResult.data;

    // 4. Save validated snapshot in memory
    setServerSnapshot({
      transactions: transactions || [],
      categories: categories || [],
      parentShareTokens: parentShareTokens || [],
      settings: settings || {},
      recurringBills: recurringBills || [],
      ious: ious || [],
      lastSyncedAt: Date.now(),
    });

    // 5. If Supabase configured, batch upsert securely
    const supabase = getServiceSupabase();
    let supabaseSynced = false;

    if (supabase) {
      try {
        // Upsert Settings
        if (settings) {
          await supabase.from('app_settings').upsert({
            id: 'global',
            monthly_budget: settings.monthlyBudget,
            fixed_recurring_bills: settings.fixedRecurringBills,
            hide_notes_from_parent: settings.hideNotesFromParent,
            api_key: settings.apiKey,
            updated_at: new Date().toISOString(),
          });
        }

        // Upsert Parent Share Tokens
        if (parentShareTokens && parentShareTokens.length > 0) {
          const tokenRows = parentShareTokens.map((t) => ({
            token: t.token,
            label: t.label,
            revoked: Boolean(t.revoked),
            created_at: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          }));
          await supabase.from('parent_share_tokens').upsert(tokenRows, { onConflict: 'token' });
        }

        // Upsert Transactions in batches of 50
        if (transactions && transactions.length > 0) {
          const txnRows = transactions.map((t) => ({
            id: t.id,
            amount: t.amount,
            type: t.type,
            category: t.category,
            merchant: t.merchant,
            raw_merchant: t.rawMerchant || null,
            bank_or_app: t.bankOrApp || null,
            upi_ref_id: t.upiRefId || null,
            timestamp: t.timestamp,
            source: t.source,
            notes: t.notes || null,
            is_categorized: Boolean(t.isCategorized),
            is_split: Boolean(t.isSplit),
            split_total_amount: t.splitTotalAmount || null,
            my_share_amount: t.myShareAmount || null,
            created_at: new Date(t.createdAt || Date.now()).toISOString(),
            updated_at: new Date(t.updatedAt || Date.now()).toISOString(),
          }));

          const chunkSize = 50;
          for (let i = 0; i < txnRows.length; i += chunkSize) {
            const chunk = txnRows.slice(i, i + chunkSize);
            await supabase.from('transactions').upsert(chunk, { onConflict: 'id' });
          }
        }

        // Upsert Recurring Bills
        if (recurringBills && recurringBills.length > 0) {
          const billRows = recurringBills.map((b) => ({
            id: b.id,
            title: b.title,
            amount: b.amount,
            category: b.category,
            billing_cycle: b.billingCycle,
            next_due_date: b.nextDueDate,
            auto_pay: Boolean(b.autoPay),
            is_active: Boolean(b.isActive),
            created_at: new Date(b.createdAt || Date.now()).toISOString(),
          }));
          await supabase.from('recurring_bills').upsert(billRows, { onConflict: 'id' });
        }

        // Upsert IOUs
        if (ious && ious.length > 0) {
          const iouRows = ious.map((item) => ({
            id: item.id,
            transaction_id: item.transactionId || null,
            person_name: item.personName,
            amount: item.amount,
            status: item.status,
            description: item.description,
            created_at: new Date(item.createdAt || Date.now()).toISOString(),
            settled_at: item.settledAt ? new Date(item.settledAt).toISOString() : null,
          }));
          await supabase.from('ious').upsert(iouRows, { onConflict: 'id' });
        }

        supabaseSynced = true;
      } catch (sbErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Supabase snapshot upsert warning:', sbErr);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        timestamp: Date.now(),
        supabaseSynced,
        message: 'Encrypted cloud snapshot updated successfully.',
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
    const msg = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Sync push failed');
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}
