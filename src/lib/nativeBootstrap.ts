import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initializeAds } from './ads';

// When the on-screen keyboard opens, the webview shrinks but inputs lower on the page
// (task/event/expense forms) can end up hidden behind it. Re-centre whichever field
// receives focus once the keyboard animation has settled.
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
    window.setTimeout(() => {
      if (document.activeElement !== target) return;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 350);
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
