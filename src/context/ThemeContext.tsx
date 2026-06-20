import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function initialTheme(): Theme {
  const stored = localStorage.getItem('kollekt-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('kollekt-theme', theme);
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Light : Style.Dark }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0D1912' : '#F1EEE2' }).catch(() => {});
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((value) => value === 'light' ? 'dark' : 'light') }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
