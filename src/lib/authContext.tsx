'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';
import { wipeLocalDatabaseOnSignOut } from './db';
import { clearUnlockSession } from './sessionAuth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; needsEmailConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getAppOrigin = (): string => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://money-flow-lac.vercel.app';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabase || !isConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function initializeAuth() {
      if (!supabase) return;

      // 1. Handle OAuth PKCE callback code if present in the browser URL
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const authCode = urlParams?.get('code');

      if (authCode) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (!exchangeError && data?.session && isMounted) {
            setSession(data.session);
            setUser(data.session.user);
            if (data.session.user?.id) {
              localStorage.setItem('mf_current_user_id', data.session.user.id);
            }

            // Remove auth code parameters from the URL cleanly
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('code');
            cleanUrl.searchParams.delete('sb_flow_id');
            cleanUrl.searchParams.delete('error');
            cleanUrl.searchParams.delete('error_description');
            window.history.replaceState({}, '', cleanUrl.toString());

            // Handle optional post-auth destination (e.g. /onboarding if initiated from signup)
            const storedNext = localStorage.getItem('mf_auth_next');
            if (storedNext) {
              localStorage.removeItem('mf_auth_next');
              if (storedNext !== window.location.pathname) {
                window.location.href = storedNext;
                return;
              }
            }
          }
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('OAuth code exchange in AuthProvider:', err);
          }
        }
      }

      // 2. Initial session load from storage / refresh
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user?.id) {
            localStorage.setItem('mf_current_user_id', initialSession.user.id);
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to retrieve initial session:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // 3. Subscribe to auth changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user?.id) {
        localStorage.setItem('mf_current_user_id', currentSession.user.id);
      } else {
        localStorage.removeItem('mf_current_user_id');
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { name: 'ConfigError', message: 'Supabase is not configured' } as AuthError };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { name: 'ConfigError', message: 'Supabase is not configured' } as AuthError };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${getAppOrigin()}/auth/callback`,
      },
    });

    const needsEmailConfirmation = Boolean(data?.user && !data?.session);
    return { error, needsEmailConfirmation };
  };

  const signInWithGoogle = async () => {
    if (!supabase) return { error: new Error('Supabase is not configured') };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${getAppOrigin()}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    clearUnlockSession();
    await wipeLocalDatabaseOnSignOut();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        // ignore network error on signout
      }
    }
    setUser(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return { error: { name: 'ConfigError', message: 'Supabase is not configured' } as AuthError };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getAppOrigin()}/auth/callback?type=recovery`,
    });
    return { error };
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isConfigured,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      resetPassword,
    }),
    [user, session, loading, isConfigured]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
