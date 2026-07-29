import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Theme = 'system' | 'light' | 'dark';
/** What actually gets painted — 'system' resolves to whichever of these matches the OS setting. */
type ResolvedTheme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
} | null>(null);

function initialTheme(): Theme {
  const stored = localStorage.getItem('kollekt-theme');
  if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Each theme's page background, mirroring --background in globals.css. Drives the native status
 *  bar and the browser chrome, both of which sit flush against the top of the page. */
const THEME_SURFACE: Record<ResolvedTheme, string> = {
  light: '#FFFFFF',
  dark: '#060A09',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  // Only relevant while theme === 'system': re-renders on a live OS appearance change.
  const [systemIsDark, setSystemIsDark] = useState<boolean>(prefersDark);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    localStorage.setItem('kollekt-theme', theme);
    // index.html ships static <meta name="theme-color"> tags for the first paint; from here on the
    // resolved theme owns it, so PWA/browser chrome doesn't stay stuck behind a switched app.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_SURFACE[resolvedTheme]);
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: resolvedTheme === 'dark' ? Style.Light : Style.Dark }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: THEME_SURFACE[resolvedTheme] }).catch(() => {});
    // Match the on-screen keyboard to the theme. iOS only exposes light/dark/default appearance —
    // it cannot be tinted cream — so this matches the theme's polarity, which is what stops a
    // white keyboard slamming up under the dark chat.
    void import('@capacitor/keyboard')
      .then(({ Keyboard, KeyboardStyle }) =>
        Keyboard.setStyle({ style: resolvedTheme === 'dark' ? KeyboardStyle.Dark : KeyboardStyle.Light }))
      .catch(() => {});
  }, [theme, resolvedTheme]);

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
