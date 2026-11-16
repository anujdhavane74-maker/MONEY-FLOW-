import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = getServiceSupabase();
    if (supabase) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('OAuth code exchange warning:', err);
        }
      }
    }
  }

  // Redirect to next destination (or onboarding / home)
  return NextResponse.redirect(`${origin}${next}`);
}
