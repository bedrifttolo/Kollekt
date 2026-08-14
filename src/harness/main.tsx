/**
 * Visual harness. Renders one real page at phone width, with the api/user/realtime/purchase layers
 * mocked (see vite.harness.config.ts), so screens behind the login wall can be looked at and
 * measured without a backend.
 *
 *   npx vite --config vite.harness.config.ts        # http://localhost:5183
 *
 * Query params:
 *   ?page=profile     which page to mount — see PAGES below. Default: profile.
 *   ?overlay=emoji    mount an overlay (sheet, modal, game shell) over ?page. See overlays.tsx.
 *   ?theme=dark       force a theme. Default: light.
 *   ?lng=no           force a locale (en | no | sv | da). Default: en. Norwegian and Danish are
 *                     where tight button padding overflows first, so check them on button work.
 *   ?width=430        viewport width in px. Default 390 (iPhone 14/15/16). 320 = iPhone SE.
 *   ?chrome=0         drop the header/nav shell and mount the page bare.
 *   ?premium=1        render as a user who owns the lifetime unlock.
 *   ?strict=1         make unmocked API calls throw instead of resolving empty.
 *   ?scenario=...     mockApi fixture scenarios (rules-404, leaderboard-error, ...).
 *
 * The shell below mirrors AppLayout exactly — same `px-4 pt-2` gutter, same header, same bottom nav.
 * That matters: the old harness wrapped the page in a bare `padding: 12` div, which added 12px to
 * every gutter and so misreported the exact screen-margin numbers this exists to check.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import i18n, { SUPPORTED_LANGUAGES, loadLanguage, type SupportedLanguage } from '../i18n';
import '../styles/globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { queryClient } from '../lib/queryClient';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { mountAudit } from './audit';
import { OVERLAY_NAMES, OverlayStage } from './overlays';

import DashboardPage from '../pages/DashboardPage';
import TasksPage from '../pages/TasksPage';
import CalendarPage from '../pages/CalendarPage';
import EconomyPage from '../pages/EconomyPage';
import PantTrackerPage from '../pages/PantTrackerPage';
import SocialPage from '../pages/SocialPage';
import ProfilePage from '../pages/ProfilePage';
import LoginPage from '../pages/LoginPage';
import CreateHouseholdPage from '../pages/CreateHouseholdPage';
import CollektGamePage from '../pages/CollektGamePage';
import ChatInboxPage from '../pages/chat/ChatInboxPage';
import ChatThreadPage from '../pages/chat/ChatThreadPage';

/**
 * Static imports on purpose. A `?page=` value can't be turned into an import path — Vite needs the
 * specifier literal at build time, the same constraint Tailwind's `source(none)` puts on class
 * names. Adding a page here is one import plus one row.
 *
 * `route` is what the MemoryRouter starts on, which is what AppHeader reads to pick its title and
 * page tone and what BottomNav reads to pick its active tab. It has to match the real route or the
 * header renders as the wrong screen.
 */
const PAGES: Record<string, { Component: React.ComponentType; route: string; chrome?: boolean }> = {
  dashboard: { Component: DashboardPage, route: '/' },
  tasks: { Component: TasksPage, route: '/tasks' },
  calendar: { Component: CalendarPage, route: '/calendar' },
  chat: { Component: ChatInboxPage, route: '/chat' },
  economy: { Component: EconomyPage, route: '/economy' },
  pant: { Component: PantTrackerPage, route: '/economy/pant' },
  social: { Component: SocialPage, route: '/social' },
  profile: { Component: ProfilePage, route: '/profile' },
  game: { Component: CollektGamePage, route: '/games/kollekt' },
  // Full-bleed routes that draw their own viewport and gutter, so no AppLayout shell.
  // The thread lives outside AppLayout in the real app too (see ChatThreadLayout) — it gets neither
  // the header nor the bottom nav, which is exactly why its own insets need checking here.
  thread: { Component: () => <ChatThreadPage thread={null} />, route: '/chat/household', chrome: false },
  login: { Component: LoginPage, route: '/login', chrome: false },
  create: { Component: CreateHouseholdPage, route: '/create-household', chrome: false },
};

const params = new URLSearchParams(window.location.search);
const pageKey = params.get('page') ?? 'profile';
const entry = PAGES[pageKey];
const width = Number(params.get('width')) || 390;
const requested = params.get('lng') ?? 'en';
const lng: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(requested)
  ? (requested as SupportedLanguage)
  : 'en';
const wantsChrome = params.get('chrome') !== '0' && entry?.chrome !== false;
const overlay = params.get('overlay');

window.addEventListener('error', (event) => {
  document.title = 'HARNESS_ERROR: ' + (event.error?.stack || event.message);
  console.error('[harness] window error', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  document.title = 'HARNESS_REJECTION: ' + (event.reason?.stack || String(event.reason));
  console.error('[harness] unhandled rejection', event.reason);
});

// ThemeProvider persists to localStorage, so seed it there rather than fighting it after mount.
if (params.get('theme') === 'dark') {
  localStorage.setItem('kollekt-theme', 'dark');
  document.documentElement.classList.add('dark');
} else if (params.get('theme') === 'light') {
  localStorage.setItem('kollekt-theme', 'light');
  document.documentElement.classList.remove('dark');
}

function Harness() {
  if (!entry) {
    return (
      <pre style={{ padding: 16, fontFamily: 'monospace' }}>
        Unknown ?page={pageKey}
        {'\n\n'}Known pages: {Object.keys(PAGES).join(', ')}
      </pre>
    );
  }
  const { Component, route } = entry;
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[route]}>
          {/*
            `transform` is load-bearing, not decoration. A transformed ancestor becomes the
            containing block for `position: fixed` descendants, so the bottom nav, the FAB and every
            sheet backdrop resolve against THIS 390px box instead of the browser viewport.

            Without it the harness silently lies: page content is constrained by `width` and looks
            right in a screenshot, while the fixed chrome lays out against a ~980px window and can
            never overflow. That is exactly how a bottom-nav label regression reached a device — the
            nav had a comfortable 576px of dock here and 369px in reality. It also makes the harness
            honest when a human opens it in a desktop browser, rather than depending on the CDP
            device-metrics override (which does not reliably apply).

            The outline marks the device edge, so the gutter between it and the content is the
            number you are actually checking.
          */}
          <div style={{ width, maxWidth: width, transform: 'translate(0)', outline: '1px solid rgba(255,0,0,.35)' }}>
            <OverlayStage name={overlay ?? ''}>
            {wantsChrome ? (
              <div className="app-viewport bg-background relative overflow-x-hidden">
                <AppHeader />
                <main className="safe-content-bottom px-4 pt-2">
                  <Component />
                </main>
                <BottomNav />
              </div>
            ) : (
              <Component />
            )}
            </OverlayStage>
          </div>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Locale bundles are code-split, so the language has to be loaded before the first paint or every
// string renders as its key and every button measures the wrong width.
void loadLanguage(lng)
  .then(() => i18n.changeLanguage(lng))
  .catch(() => {})
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    );
    mountAudit(overlay ? `overlay:${overlay}` : pageKey);
  });

window.setTimeout(() => {
  if (document.title.indexOf('HARNESS_ERROR') === -1 && document.title.indexOf('HARNESS_REJECTION') === -1) {
    document.title = 'HARNESS_OK root-children=' + (document.getElementById('root')?.childElementCount ?? -1);
  }
}, 4000);
