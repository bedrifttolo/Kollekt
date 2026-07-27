import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Theme = 'light' | 'dark' | 'pink';

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function initialTheme(): Theme {
  const stored = localStorage.getItem('kollekt-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'pink') return stored;
  return 'light';
}

/** Each theme's page background, mirroring --background in globals.css. Drives the native status
 *  bar and the browser chrome, both of which sit flush against the top of the page. */
const THEME_SURFACE: Record<Theme, string> = {
  light: '#F7F2EC',
  dark: '#060A09',
  pink: '#FDEEF4',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('pink', theme === 'pink');
    localStorage.setItem('kollekt-theme', theme);
    // index.html ships a static <meta name="theme-color"> for the first paint; from here on the
    // selected theme owns it, so PWA/browser chrome doesn't stay white behind a dark app.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_SURFACE[theme]);
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Light : Style.Dark }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: THEME_SURFACE[theme] }).catch(() => {});
    // Match the on-screen keyboard to the theme. iOS only exposes light/dark/default appearance —
    // it cannot be tinted cream or pink — so this matches the theme's polarity, which is what
    // stops a white keyboard slamming up under the dark chat.
    void import('@capacitor/keyboard')
      .then(({ Keyboard, KeyboardStyle }) =>
        Keyboard.setStyle({ style: theme === 'dark' ? KeyboardStyle.Dark : KeyboardStyle.Light }))
      .catch(() => {});
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
