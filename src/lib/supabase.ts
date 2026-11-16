import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseServiceKey =
  rawServiceKey && !rawServiceKey.includes('your-service-role-key')
    ? rawServiceKey
    : supabaseAnonKey;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));
}

// Client-side Supabase client (using anon key)
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side admin Supabase client (using service role or anon key)
export function getServiceSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
