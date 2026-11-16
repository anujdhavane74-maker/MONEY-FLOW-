import { NextRequest, NextResponse } from 'next/server';
import { parseIndianFinancialSms } from '@/lib/smsParser';
import { queueWebhookTransaction } from '@/lib/serverQueue';
import { getServiceSupabase } from '@/lib/supabase';
import { Transaction } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';
import { authenticateApiRequest, getSafeCorsHeaders } from '@/lib/serverAuth';
import { smsIngestSchema } from '@/lib/validations';

export async function OPTIONS(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);

  try {
    // 1. Rate Limiting (Max 30 requests / minute per IP)
    const rateCheck = checkRateLimit(req, 30, 60000);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please slow down and try again later.',
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': '60',
            'X-RateLimit-Limit': String(rateCheck.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateCheck.reset),
          },
        }
      );
    }

    // 2. Read body text
    let rawText = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      rawText = body.text || body.sms || body.message || body.notification || body.body || '';
    } else {
      rawText = await req.text();
    }

    // 3. Timing-Safe Multi-Tenant Authentication (Per-User API Keys)
    const authResult = await authenticateApiRequest(req, rawText);
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.reason || 'Unauthorized access: Invalid or missing API credentials.',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    // 4. Strict Input Validation (Zod)
    const validationResult = smsIngestSchema.safeParse({ text: rawText });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0]?.message || 'Invalid SMS payload input format.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const validatedText = validationResult.data.text;
    const parsed = parseIndianFinancialSms(validatedText);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.errorMessage || 'Unable to parse transaction from given text.',
        },
        { status: 422, headers: corsHeaders }
      );
    }

    // 5. Build Standardized Transaction Record (Multi-Tenant Isolated)
    const txnId = `txn-sms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const effectiveUserId = authResult.userId && authResult.userId !== 'default-owner' ? authResult.userId : undefined;

    const newTxn: Transaction = {
      id: txnId,
      userId: effectiveUserId,
      amount: parsed.amount ?? 0,
      type: parsed.type ?? 'expense',
      category: 'Uncategorized',
      merchant: parsed.merchant ?? 'Unknown Merchant',
      rawMerchant: parsed.merchant,
      bankOrApp: parsed.bankOrApp,
      upiRefId: parsed.upiRefId,
      timestamp: parsed.timestamp || Date.now(),
      source: 'webhook',
      notes: parsed.rawText ? `Auto-captured from SMS: ${parsed.rawText.slice(0, 100)}` : '',
      isCategorized: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 6. Queue locally in memory
    queueWebhookTransaction(newTxn);

    // 7. Persist to Supabase with strict user_id scoping if configured
    let supabaseSaved = false;
    const supabase = getServiceSupabase();
    if (supabase) {
      try {
        await supabase.from('webhook_queue').insert({
          id: newTxn.id,
          user_id: effectiveUserId || null,
          payload: newTxn,
          synced: false,
          created_at: new Date().toISOString(),
        });

        await supabase.from('transactions').upsert({
          id: newTxn.id,
          user_id: effectiveUserId || null,
          amount: newTxn.amount,
          type: newTxn.type,
          category: newTxn.category,
          merchant: newTxn.merchant,
          raw_merchant: newTxn.rawMerchant,
          bank_or_app: newTxn.bankOrApp,
          upi_ref_id: newTxn.upiRefId,
          timestamp: newTxn.timestamp,
          source: newTxn.source,
          notes: newTxn.notes,
          is_categorized: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        supabaseSaved = true;
      } catch (sbError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Supabase sync warning:', sbError);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Transaction captured and queued successfully.',
        supabaseSaved,
        transaction: newTxn,
        parsed: {
          amount: newTxn.amount,
          type: newTxn.type,
          merchant: newTxn.merchant,
          bankOrApp: newTxn.bankOrApp,
          upiRefId: newTxn.upiRefId,
          timestamp: newTxn.timestamp,
        },
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
    const errorMsg = isProd ? 'Internal Server Error' : (error instanceof Error ? error.message : 'Unknown Error');
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: NextRequest) {
  const corsHeaders = getSafeCorsHeaders(req);

  return NextResponse.json(
    {
      name: 'Money Flow Ingest SMS API',
      status: 'online',
      security: 'HMAC-SHA256 / Timing-Safe Token Authentication Required',
      rateLimit: '30 requests / minute',
      instructions: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '<your-secret-key-or-token>',
        },
        bodyExample: {
          text: 'Dear Customer, Your A/c XXXX1234 is debited by INR 150.00 on 16-Nov-26 by UPI Ref No 418291029182 to ANAND VADAPAV.',
        },
      },
    },
    { status: 200, headers: corsHeaders }
  );
}
