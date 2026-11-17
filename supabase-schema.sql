-- ==============================================================================
-- Money Flow: Supabase Database Schema & Multi-Tenant Security Setup
-- Fully idempotent: Safe to execute on both fresh projects and existing databases.
-- Paste and run this script directly in the Supabase SQL Editor (SQL Editor -> New Query).
-- ==============================================================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. App Settings Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget NUMERIC DEFAULT 25000,
  fixed_recurring_bills NUMERIC DEFAULT 8000,
  hide_notes_from_parent BOOLEAN DEFAULT FALSE,
  api_key TEXT,
  currency TEXT DEFAULT 'INR',
  theme TEXT DEFAULT 'system',
  pin_hash TEXT,
  pin_enabled BOOLEAN DEFAULT FALSE,
  auto_lock_minutes INT DEFAULT 5,
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column migrations for existing tables
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC DEFAULT 25000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS fixed_recurring_bills NUMERIC DEFAULT 8000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS hide_notes_from_parent BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS auto_lock_minutes INT DEFAULT 5;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_api_key ON app_settings (api_key);

-- Default global fallback row
INSERT INTO app_settings (id, monthly_budget, fixed_recurring_bills, currency, theme)
VALUES ('global', 25000, 8000, 'INR', 'system')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 2. Parent Share Tokens Table (Guardian View Access)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS parent_share_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  expires_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE parent_share_tokens ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE parent_share_tokens ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE parent_share_tokens ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE;
ALTER TABLE parent_share_tokens ADD COLUMN IF NOT EXISTS expires_at BIGINT;
ALTER TABLE parent_share_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_parent_share_tokens_user ON parent_share_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_parent_share_tokens_revoked ON parent_share_tokens (revoked);

-- Seed demo parent guardian token for instant testing
INSERT INTO parent_share_tokens (token, label, revoked)
VALUES ('demo-parent-guardian-2026', 'Demo Guardian Access', false)
ON CONFLICT (token) DO NOTHING;

-- ==============================================================================
-- 3. Transactions Ledger Table
-- ==============================================================================
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

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_merchant TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_or_app TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS upi_ref_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_categorized BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS split_total_amount NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS my_share_amount NUMERIC;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_user_timestamp ON transactions (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions (user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
CREATE INDEX IF NOT EXISTS idx_transactions_upi_ref ON transactions (upi_ref_id);

-- ==============================================================================
-- 4. Recurring Bills & Subscriptions Table
-- ==============================================================================
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

ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS auto_pay BOOLEAN DEFAULT FALSE;
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE recurring_bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_recurring_bills_user ON recurring_bills (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_due ON recurring_bills (user_id, next_due_date);

-- ==============================================================================
-- 5. Split & IOUs Ledger Table (Mini-Splitwise)
-- ==============================================================================
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

ALTER TABLE ious ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ious ADD COLUMN IF NOT EXISTS creditor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ious ADD COLUMN IF NOT EXISTS debtor_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ious ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'pending';
ALTER TABLE ious ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE ious ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ious ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ious_user_status ON ious (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ious_creditor_status ON ious (creditor_user_id, settlement_status);
CREATE INDEX IF NOT EXISTS idx_ious_debtor_status ON ious (debtor_user_id, settlement_status);
CREATE INDEX IF NOT EXISTS idx_ious_transaction_id ON ious (transaction_id);

-- ==============================================================================
-- 6. User API Keys Table (Per-User MacroDroid/Tasker Webhook Routing)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  label TEXT DEFAULT 'MacroDroid Phone Key',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'MacroDroid Phone Key';
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_api_keys_key ON user_api_keys (api_key);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys (user_id);

-- ==============================================================================
-- 7. Webhook Ingestion Queue
-- ==============================================================================
CREATE TABLE IF NOT EXISTS webhook_queue (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_queue ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE webhook_queue ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT FALSE;
ALTER TABLE webhook_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_webhook_queue_user_synced ON webhook_queue (user_id, synced);
CREATE INDEX IF NOT EXISTS idx_webhook_queue_synced ON webhook_queue (synced);

-- ==============================================================================
-- 8. Categories Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'savings')),
  icon TEXT,
  color TEXT,
  budget_monthly NUMERIC,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS budget_monthly NUMERIC;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

-- ==============================================================================
-- 9. Savings Goals Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  deadline TEXT,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS current_amount NUMERIC DEFAULT 0;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals (user_id);

-- ==============================================================================
-- 10. Learned Merchant Auto-Tagging Rules Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS merchant_rules (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category_id TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE merchant_rules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE merchant_rules ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 1.0;
ALTER TABLE merchant_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_merchant_rules_user_kw ON merchant_rules (user_id, keyword);

-- ==============================================================================
-- 11. Quick Spend Speed Dial Presets Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS quick_spends (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quick_spends ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE quick_spends ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE quick_spends ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE quick_spends ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_quick_spends_user ON quick_spends (user_id);

-- ==============================================================================
-- 12. Enable Row-Level Security (RLS) On All Tables
-- ==============================================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE ious ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_spends ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 13. Idempotently Reset Existing Policies
-- ==============================================================================
DROP POLICY IF EXISTS "Allow public read-write for app_settings" ON app_settings;
DROP POLICY IF EXISTS "Owner access for app_settings" ON app_settings;
DROP POLICY IF EXISTS "Users can manage their own app settings" ON app_settings;
DROP POLICY IF EXISTS "Parents can read app settings with active share token" ON app_settings;

DROP POLICY IF EXISTS "Allow public read-write for parent_share_tokens" ON parent_share_tokens;
DROP POLICY IF EXISTS "Owner manage share tokens" ON parent_share_tokens;
DROP POLICY IF EXISTS "Public read active tokens" ON parent_share_tokens;
DROP POLICY IF EXISTS "Users can manage their own share tokens" ON parent_share_tokens;
DROP POLICY IF EXISTS "Public read active share tokens" ON parent_share_tokens;

DROP POLICY IF EXISTS "Allow public read-write for transactions" ON transactions;
DROP POLICY IF EXISTS "Owner access for transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
DROP POLICY IF EXISTS "Parents can read transactions with active share token" ON transactions;

DROP POLICY IF EXISTS "Allow public read-write for recurring_bills" ON recurring_bills;
DROP POLICY IF EXISTS "Owner access for recurring_bills" ON recurring_bills;
DROP POLICY IF EXISTS "Users can manage their own recurring bills" ON recurring_bills;

DROP POLICY IF EXISTS "Allow public read-write for ious" ON ious;
DROP POLICY IF EXISTS "Owner access for ious" ON ious;
DROP POLICY IF EXISTS "Users can manage their own ious" ON ious;

DROP POLICY IF EXISTS "Owner access for user_api_keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can manage their own api keys" ON user_api_keys;

DROP POLICY IF EXISTS "Allow public read-write for webhook_queue" ON webhook_queue;
DROP POLICY IF EXISTS "Owner access for webhook_queue" ON webhook_queue;
DROP POLICY IF EXISTS "Ingestion write to webhook_queue" ON webhook_queue;
DROP POLICY IF EXISTS "Users can manage their own webhook queue" ON webhook_queue;
DROP POLICY IF EXISTS "Allow public insert into webhook queue" ON webhook_queue;

DROP POLICY IF EXISTS "Owner access for categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;

DROP POLICY IF EXISTS "Owner access for savings_goals" ON savings_goals;
DROP POLICY IF EXISTS "Users can manage their own savings goals" ON savings_goals;

DROP POLICY IF EXISTS "Users can manage their own merchant rules" ON merchant_rules;
DROP POLICY IF EXISTS "Users can manage their own quick spends" ON quick_spends;

-- ==============================================================================
-- 14. Define Multi-Tenant RLS Policies
-- ==============================================================================

-- 1. App Settings: Owner full CRUD + Parent Token Read Access + Unauthenticated Global Fallback
CREATE POLICY "Users can manage their own app settings" ON app_settings
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Parents can read app settings with active share token" ON app_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_share_tokens
      WHERE parent_share_tokens.user_id = app_settings.user_id
        AND parent_share_tokens.revoked = false
    )
  );

-- 2. Parent Share Tokens: Owner full CRUD + Public read for active tokens
CREATE POLICY "Users can manage their own share tokens" ON parent_share_tokens
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Public read active share tokens" ON parent_share_tokens
  FOR SELECT USING (revoked = false);

-- 3. Transactions: Owner full CRUD + Parent Token Read Access
CREATE POLICY "Users can manage their own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Parents can read transactions with active share token" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM parent_share_tokens
      WHERE parent_share_tokens.user_id = transactions.user_id
        AND parent_share_tokens.revoked = false
    )
  );

-- 4. Recurring Bills: Owner full CRUD
CREATE POLICY "Users can manage their own recurring bills" ON recurring_bills
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 5. IOUs: Owner full CRUD
CREATE POLICY "Users can manage their own ious" ON ious
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 6. User API Keys: Owner full CRUD
CREATE POLICY "Users can manage their own api keys" ON user_api_keys
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 7. Webhook Queue: Public Ingestion write + Owner queue manage
CREATE POLICY "Allow public insert into webhook queue" ON webhook_queue
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage their own webhook queue" ON webhook_queue
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 8. Categories: Owner full CRUD
CREATE POLICY "Users can manage their own categories" ON categories
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 9. Savings Goals: Owner full CRUD
CREATE POLICY "Users can manage their own savings goals" ON savings_goals
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 10. Merchant Rules: Owner full CRUD
CREATE POLICY "Users can manage their own merchant rules" ON merchant_rules
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 11. Quick Spends: Owner full CRUD
CREATE POLICY "Users can manage their own quick spends" ON quick_spends
  FOR ALL USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
