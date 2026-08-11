import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './ui-kit';
import { useUser } from '../context/UserContext';

/**
 * Session-shell guarantees shared by every authenticated screen, whether it renders inside
 * AppLayout's chrome (header + bottom nav) or a chrome-less full-screen layout (chat threads):
 * the boot splash, the login/create-household redirects, and the on-screen-keyboard handling
 * (keyboard-open class + tap-outside-a-field blur). Extracted out of AppLayout so a chrome-less
 * route gets the same guarantees without duplicating this logic.
 */
// Module-scope, not component state: AppLayout and ChatThreadLayout each mount their own AuthGate
// as sibling routes, so React Router unmounts/remounts AuthGate on every inbox<->thread
// navigation. Component state would re-arm the splash on each of those; this flag survives across
// remounts for the life of the JS session and only resets on a real cold launch/reload.
let bootSplashShown = false;

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useUser();
  const { t } = useTranslation();

  // Holds the boot splash (logo + "Kollekt") on screen for a fixed branding beat on the very first
  // AuthGate mount of the session, regardless of how fast the session restore below actually
  // resolves. Later mounts (e.g. navigating between the chat inbox and a thread) skip it entirely.
  const [minSplashElapsed, setMinSplashElapsed] = useState(bootSplashShown);
  useEffect(() => {
    if (bootSplashShown) return;
    const timer = window.setTimeout(() => {
      bootSplashShown = true;
      setMinSplashElapsed(true);
    }, 1000);
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
      const target = e.target instanceof Node ? e.target : null;
      const targetField = target instanceof Element ? target.closest('input, textarea, select, [contenteditable="true"]') : null;
      // Focus from the user's pointer gesture itself. WKWebView then treats it like a native
      // control tap, so the keyboard starts immediately across every form in the app instead of
      // waiting for a later render/scroll pass.
      if (targetField && isField(targetField) && targetField !== active && targetField instanceof HTMLElement) {
        targetField.focus({ preventScroll: true });
        return;
      }
      if (!isField(active)) return;
      if (target && active.contains(target)) return;
      if (targetField && isField(targetField)) return;
      // Chat's message list scrolls independently while the composer stays focused (and the
      // keyboard stays open) — a tap/drag there shouldn't dismiss it the way tapping real chrome
      // (the header, another sheet) does.
      if (target instanceof Element && target.closest('[data-chat-scroll]')) return;
      // Same for the composer bar itself: blurring on pointerdown (before the button's click even
      // fires) was eating the first tap on Send — the keyboard would start closing and shifting
      // layout out from under the tap, so it took a second tap to actually land on the button.
      if (target instanceof Element && target.closest('[data-chat-composer]')) return;
      active.blur();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

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

  return <>{children}</>;
}
