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

const STATUS_BAR_COLOR: Record<Theme, string> = {
  light: '#F1EEE2',
  dark: '#0D1912',
  pink: '#FDEEF4',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('pink', theme === 'pink');
    localStorage.setItem('kollekt-theme', theme);
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Light : Style.Dark }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR[theme] }).catch(() => {});
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
