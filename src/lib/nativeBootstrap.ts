import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initializeAds } from './ads';
import { onKeyboardInset } from './keyboardInsets';

// When the on-screen keyboard opens, the page shrinks around it but inputs lower down
// (task/event/expense forms) can end up hidden behind it. Re-centre whichever field
// receives focus. The focus itself must stay on the user's gesture; this only keeps the field
// visible once the layout has made room.
function bindKeyboardScrollAssist(): void {
  const assisted = (el: EventTarget | Element | null): HTMLElement | null => {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLTextAreaElement) &&
      !(el instanceof HTMLSelectElement)
    ) {
      return null;
    }
    // Chat's composer keeps its own message list pinned to the newest message instead of
    // centering the input — this generic assist would fight that and double-jump the page.
    return el.dataset.keyboardScrollAssist === 'off' ? null : el;
  };
  const recentre = (target: HTMLElement) => {
    window.requestAnimationFrame(() => {
      if (document.activeElement !== target) return;
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
  };
  document.addEventListener('focusin', (event) => {
    const target = assisted(event.target);
    if (target) recentre(target);
  });
  // The focusin pass above runs before the keyboard has reported its height, so it can only
  // centre the field within the still-full-height page. Run it again once the inset is known and
  // the surrounding layout has actually shrunk, which is when "centred" finally means centred in
  // the space left above the keyboard.
  onKeyboardInset(({ height, durationMs }) => {
    if (height === 0) return;
    const target = assisted(document.activeElement);
    if (!target) return;
    window.setTimeout(() => recentre(target), durationMs);
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
