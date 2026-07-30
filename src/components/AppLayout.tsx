import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import TourOverlay, { type TourStep } from './TourOverlay';
import { BrandMark, LoadingDot } from './ui-kit';
import { useUser } from '../context/UserContext';
import { useScrollDirection } from '../lib/useScrollDirection';

const APP_TOUR_STEPS: TourStep[] = [
  { route: '/', selector: '[data-tour="nav-home"]', titleKey: 'tour.steps.home.title', bodyKey: 'tour.steps.home.body' },
  { route: '/tasks', selector: '[data-tour="nav-tasks"]', titleKey: 'tour.steps.tasks.title', bodyKey: 'tour.steps.tasks.body' },
  { route: '/calendar', selector: '[data-tour="nav-calendar"]', titleKey: 'tour.steps.calendar.title', bodyKey: 'tour.steps.calendar.body' },
  { route: '/chat', selector: '[data-tour="nav-chat"]', titleKey: 'tour.steps.chat.title', bodyKey: 'tour.steps.chat.body' },
  { route: '/economy', selector: '[data-tour="nav-economy"]', titleKey: 'tour.steps.economy.title', bodyKey: 'tour.steps.economy.body' },
  { route: '/social', selector: '[data-tour="nav-social"]', titleKey: 'tour.steps.social.title', bodyKey: 'tour.steps.social.body' },
  { route: '/profile', selector: '[data-tour="profile"]', titleKey: 'tour.steps.profile.title', bodyKey: 'tour.steps.profile.body' },
];

export default function AppLayout() {
  const { currentUser, isLoading } = useUser();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  // Chat renders its own compact header (thread info + profile button) so the shared
  // header would just duplicate it and cost the messages a full row of space.
  const hideHeader = pathname === '/chat';

  // Holds the boot splash (logo + "Kollekt") on screen for a fixed 1.5s branding beat on every
  // cold launch, regardless of how fast the session restore below actually resolves. This
  // component only mounts once per fresh JS context — native app backgrounding/resume doesn't
  // remount it — so it naturally never re-fires on a plain tab switch back into the app.
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setMinSplashElapsed(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // While the on-screen keyboard is up, mark the root so the fixed bottom nav hides and
  // inputs dock directly above the keyboard (iOS resizes the webview natively). Focus
  // moving between two text fields keeps the class on (checked after the event settles).
  useEffect(() => {
    const opensKeyboard = (el: EventTarget | null): boolean => {
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLElement && el.isContentEditable) return true;
      if (el instanceof HTMLInputElement) {
        return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image'].includes(el.type);
      }
      return false;
    };
    const root = document.documentElement;
    const onFocusIn = (e: FocusEvent) => {
      if (opensKeyboard(e.target)) root.classList.add('keyboard-open');
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!opensKeyboard(document.activeElement)) root.classList.remove('keyboard-open');
      }, 0);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      root.classList.remove('keyboard-open');
    };
  }, []);

  // Tapping anywhere outside the focused field blurs it, dismissing the on-screen keyboard —
  // WKWebView doesn't do this on its own the way native controls do, which is most noticeable in
  // forms (add-task/add-event/etc. sheets) and the chat composer. A field is left alone (and any
  // tap that lands back inside it, or on another field, doesn't blur) so tabbing between inputs
  // still works.
  useEffect(() => {
    const isField = (el: Element | null): el is HTMLElement =>
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLElement && el.isContentEditable);
    const onPointerDown = (e: PointerEvent) => {
      const active = document.activeElement;
      if (!isField(active)) return;
      const target = e.target instanceof Node ? e.target : null;
      if (target && active.contains(target)) return;
      if (target instanceof Element && isField(target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      // Chat's message list scrolls independently while the composer stays focused (and the
      // keyboard stays open) — a tap/drag there shouldn't dismiss it the way tapping real chrome
      // (the header, another sheet) does.
      if (target instanceof Element && target.closest('[data-chat-scroll]')) return;
      active.blur();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Covers every page except Chat, which has its own internal scroll container (wired up in
  // ChatPage itself) since its `.app-screen-full` layout never grows past the viewport.
  useScrollDirection();

  if (!minSplashElapsed || (isLoading && !currentUser)) {
    return (
      <div className="app-viewport bg-background relative flex flex-col items-center justify-center gap-4">
        <BrandMark className="h-24 w-24" />
        <span className="font-display font-extrabold text-3xl tracking-tight text-foreground">Kollekt</span>
        <p className="absolute bottom-8 text-xs text-muted-foreground/70">{t('common.credits')}</p>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.collectiveCode) return <Navigate to="/create-household" replace />;

  return (
    <div className="app-viewport bg-background max-w-xl mx-auto relative overflow-x-hidden">
      {!hideHeader && <AppHeader />}
      <main className="safe-content-bottom px-4 sm:px-6 pt-2">
        {/* Keeps header + bottom nav visible while a lazily loaded tab's chunk downloads. No
            route-level fade here: each page seeds its own loading/data state from the shared query
            cache, so a warm tab paints instantly on mount instead of fading in from a blank frame. */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center pt-16">
              <LoadingDot />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      <TourOverlay steps={APP_TOUR_STEPS} storageKey={`kollekt_tour_v2_${currentUser.id}`} />
    </div>
  );
}
