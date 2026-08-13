import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initializeAds } from './ads';
import { keyboardHeight, onKeyboardInset } from './keyboardInsets';

// When the on-screen keyboard opens, the page shrinks around it but inputs lower down
// (task/event/expense forms) can end up hidden behind it. Re-centre whichever field receives
// focus. The focus itself must stay on the user's gesture; this only keeps the field visible once
// the layout has made room. This is the app's *only* keyboard-avoidance path for form fields —
// AddSheet used to run a competing one of its own, and two owners meant two jumps per field.
function bindKeyboardScrollAssist(): void {
  const assisted = (el: EventTarget | Element | null): HTMLElement | null => {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      return null;
    }
    // Chat keeps its own scroll pinned to the newest message instead of centering the focused
    // field — this generic assist would fight that and double-jump the thread.
    return el.dataset.keyboardScrollAssist === 'off' ? null : el;
  };
  // Idempotent by design: a field that is already fully in view above the keyboard is left exactly
  // where it is. That is what makes it safe to run this from three different signals below —
  // whichever fires first does the work, and the rest become no-ops instead of extra jumps.
  const recentreIfObscured = (target: HTMLElement) => {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== target) return;
      // iOS keeps the webview full-height and reports the keyboard separately; Android and web
      // shrink innerHeight itself and report 0. Subtracting both covers all three.
      const visibleBottom = window.innerHeight - keyboardHeight();
      const rect = target.getBoundingClientRect();
      if (rect.top >= 0 && rect.bottom <= visibleBottom) return;
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  };
  // Focus: the earliest signal, and on a page with room to spare it is the only one needed.
  document.addEventListener('focusin', (event) => {
    const target = assisted(event.target);
    if (target) recentreIfObscured(target);
  });
  // Resize: Android's signal. Nothing publishes a keyboard inset there — Capacitor's own window
  // insets listener shrinks the WebView instead — so the room only appears after focusin has
  // already run, and this is the pass that actually rescues an obscured field.
  window.addEventListener('resize', () => {
    const target = assisted(document.activeElement);
    if (target) recentreIfObscured(target);
  });
  // Keyboard inset: iOS's signal, where the webview never resizes. Waits out the show animation so
  // that "centred" is measured against the layout the keyboard finally left behind.
  onKeyboardInset(({ height, durationMs }) => {
    if (height === 0) return;
    const target = assisted(document.activeElement);
    if (!target) return;
    window.setTimeout(() => recentreIfObscured(target), durationMs);
  });
}

// One-time native shell setup: status bar styling over the light-first theme, then hide
// the launch splash once the web layer is ready. No-op on the web build.
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  bindKeyboardScrollAssist();
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#F7F2EC' });
    }
  } catch {
    // Status bar plugin unavailable on this platform; ignore.
  } finally {
    await SplashScreen.hide().catch(() => undefined);
  }
  // Initializes ads + ATT when ads are enabled; a no-op otherwise.
  await initializeAds().catch(() => undefined);
}
