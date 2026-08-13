import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import App from './App';
import './i18n';
import './styles/globals.css';
import { initNativeShell } from './lib/nativeBootstrap';
import { ThemeProvider } from './context/ThemeContext';
import { queryClient } from './lib/queryClient';
import { warmUpBackend } from './lib/api';
import { initPurchases } from './lib/purchases';
import { initKeyboardInsets } from './lib/keyboardInsets';

// Open the connection before anything renders, so the first request is not the one that pays for it.
warmUpBackend();

// Armed before the first paint, not on the deferred native-shell pass below: the keyboard can be
// summoned by the very first tap on the login screen, and a listener attached late would miss the
// keyboardWillShow that opens it — leaving that one field docked behind the keyboard.
initKeyboardInsets();

// Persist the query cache to localStorage (persisted across app launches in the iOS/Android
// WebView too). On reopen the last-known data renders instantly, then refreshes in the
// background — no blank spinner while the slow backend responds.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'kollekt-query-cache',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60_000, // discard persisted data older than 24h
        buster: import.meta.env.VITE_APP_VERSION ?? 'v1', // bump to invalidate all persisted caches
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);

window.setTimeout(() => {
  void initNativeShell();
  void initPurchases();
}, 0);
