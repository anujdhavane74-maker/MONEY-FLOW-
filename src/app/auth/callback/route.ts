import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const defaultOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://money-flow-lac.vercel.app';
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : (new URL(req.url).origin || defaultOrigin);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error') || searchParams.get('error_description');
  const next = searchParams.get('next') || '/';

  // 1. Handle OAuth provider errors (e.g. user denied consent)
  if (error) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', error);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Handle successful authorization code
  if (code) {
    // Attempt server-side exchange if supported
    const supabase = getServiceSupabase();
    if (supabase) {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch {
        // Expected for client PKCE flow where code verifier is stored in browser localStorage
      }
    }

    // Forward the authorization code and relevant query parameters to the destination page
    // so the client-side Supabase SDK can complete the PKCE exchange using localStorage
    const redirectUrl = new URL(next.startsWith('/') ? next : `/${next}`, origin);
    searchParams.forEach((val, key) => {
      redirectUrl.searchParams.set(key, val);
    });
    return NextResponse.redirect(redirectUrl);
  }

  // Fallback redirect if no code was supplied
  return NextResponse.redirect(`${origin}${next}`);
}
