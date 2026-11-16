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

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user?.id) {
        localStorage.setItem('mf_current_user_id', initialSession.user.id);
      }
      setLoading(false);
    });

    // 2. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
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
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
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
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
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
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?type=recovery` : undefined,
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
