import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './i18n';
import './styles/globals.css';
import { initNativeShell } from './lib/nativeBootstrap';
import { ThemeProvider } from './context/ThemeContext';
import { queryClient } from './lib/queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

window.setTimeout(() => {
  void initNativeShell();
}, 0);
