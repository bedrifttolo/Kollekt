import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initializeAds } from './ads';

// When the on-screen keyboard opens, the webview shrinks but inputs lower on the page
// (task/event/expense forms) can end up hidden behind it. Re-centre whichever field
// receives focus. The focus itself must stay on the user's gesture; this only keeps the field
// visible after the native viewport resize.
function bindKeyboardScrollAssist(): void {
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement) &&
      !(target instanceof HTMLSelectElement)
    ) {
      return;
    }
    // Chat's composer keeps its own message list pinned to the newest message instead of
    // centering the input — this generic assist would fight that and double-jump the page.
    if (target.dataset.keyboardScrollAssist === 'off') return;
    window.requestAnimationFrame(() => {
      if (document.activeElement !== target) return;
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
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
