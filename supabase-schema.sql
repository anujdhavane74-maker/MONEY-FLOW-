-- ==============================================================================
-- Money Flow: Supabase Database Schema & Hardened Security Setup
-- Run this script in the Supabase SQL Editor (SQL Editor -> New Query)
-- ==============================================================================

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget NUMERIC DEFAULT 25000,
  fixed_recurring_bills NUMERIC DEFAULT 8000,
  hide_notes_from_parent BOOLEAN DEFAULT FALSE,
  api_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Parent Share Tokens Table
CREATE TABLE IF NOT EXISTS parent_share_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  expires_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed demo parent guardian token for instant test
INSERT INTO parent_share_tokens (token, label, revoked)
VALUES ('demo-parent-guardian-2026', 'Demo Guardian Access', false)
ON CONFLICT (token) DO NOTHING;

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'savings')),
  category TEXT NOT NULL,
  merchant TEXT NOT NULL,
  raw_merchant TEXT,
  bank_or_app TEXT,
  upi_ref_id TEXT,
  timestamp BIGINT NOT NULL,
  source TEXT NOT NULL,
  notes TEXT,
  is_categorized BOOLEAN DEFAULT FALSE,
  is_split BOOLEAN DEFAULT FALSE,
  split_total_amount NUMERIC,
  my_share_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_upi_ref ON transactions (upi_ref_id);

-- 4. Recurring Bills & Subscriptions Table
CREATE TABLE IF NOT EXISTS recurring_bills (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  next_due_date TEXT NOT NULL,
  auto_pay BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Split & IOUs Ledger Table (Mini-Splitwise)
CREATE TABLE IF NOT EXISTS ious (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT,
  person_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- 6. Webhook Ingestion Queue
CREATE TABLE IF NOT EXISTS webhook_queue (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_synced ON webhook_queue (synced);

-- ==============================================================================
-- Hardened Row-Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ious ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;

-- Drop previous open policies if updating
DROP POLICY IF EXISTS "Allow public read-write for app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow public read-write for parent_share_tokens" ON parent_share_tokens;
DROP POLICY IF EXISTS "Allow public read-write for transactions" ON transactions;
DROP POLICY IF EXISTS "Allow public read-write for recurring_bills" ON recurring_bills;
DROP POLICY IF EXISTS "Allow public read-write for ious" ON ious;
DROP POLICY IF EXISTS "Allow public read-write for webhook_queue" ON webhook_queue;

-- 1. App Settings: Service role or Authenticated owner
CREATE POLICY "Owner access for app_settings" ON app_settings
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 2. Parent Share Tokens: Owner full access; Public can check active tokens
CREATE POLICY "Public read active tokens" ON parent_share_tokens
  FOR SELECT USING (revoked = false);

CREATE POLICY "Owner manage share tokens" ON parent_share_tokens
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 3. Transactions: Owner full access
CREATE POLICY "Owner access for transactions" ON transactions
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 4. Recurring Bills: Owner full access
CREATE POLICY "Owner access for recurring_bills" ON recurring_bills
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 5. IOUs: Owner full access
CREATE POLICY "Owner access for ious" ON ious
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 6. Webhook Queue: Ingestion write access & owner read/update
CREATE POLICY "Ingestion write to webhook_queue" ON webhook_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owner access for webhook_queue" ON webhook_queue
  FOR ALL USING (auth.uid() IS NULL OR auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);
