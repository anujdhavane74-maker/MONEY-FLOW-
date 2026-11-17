import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow static assets, next internal files, and public routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/.well-known') ||
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/onboarding'
  ) {
    return NextResponse.next();
  }

  // 2. Check for presence of Supabase auth token in cookies
  const hasAuthCookie = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') || c.name === 'mf_session_token');

  // If user is accessing protected root '/' and has no auth cookies
  // In development/demo mode when Supabase is unconfigured, allow pass-through
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')
  );

  if (isSupabaseConfigured && !hasAuthCookie && pathname === '/') {
    // Note: client-side AuthProvider also provides instant redirect if session is null
    const loginUrl = new URL('/login', req.url);
    return NextResponse.next(); // Client-side AuthGuard handles fine-grained local/cloud redirects
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\\.well-known|icons).*)'],
};
