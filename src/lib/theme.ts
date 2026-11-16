'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mf_theme';

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (e) {
    // ignore
  }
  return 'system';
}

export function applyTheme(theme: Theme): ResolvedTheme {
  if (typeof document === 'undefined') return 'dark';

  const resolved: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
  }

  // Update theme-color meta tag for PWA status bar
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#090d16' : '#f8fafc');
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // ignore
  }

  // Dispatch custom event for cross-component sync
  window.dispatchEvent(new CustomEvent('mf-theme-change', { detail: { theme, resolved } }));

  return resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initialTheme = getStoredTheme();
    setThemeState(initialTheme);
    const resolved = applyTheme(initialTheme);
    setResolvedTheme(resolved);

    // Listener for system preference change
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (getStoredTheme() === 'system') {
        const newResolved = applyTheme('system');
        setResolvedTheme(newResolved);
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    // Listener for manual theme change
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: Theme; resolved: ResolvedTheme }>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail.theme);
        setResolvedTheme(customEvent.detail.resolved);
      }
    };
    window.addEventListener('mf-theme-change', handleThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
      window.removeEventListener('mf-theme-change', handleThemeChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = applyTheme(newTheme);
    setResolvedTheme(resolved);
  }, []);

  return { theme, resolvedTheme, setTheme, mounted };
}
