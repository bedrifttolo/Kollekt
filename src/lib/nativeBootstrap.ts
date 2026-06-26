import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initializeAds } from './ads';

// One-time native shell setup: status bar styling over the light-first theme, then hide
// the launch splash once the web layer is ready. No-op on the web build.
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#F1EEE2' });
    }
  } catch {
    // Status bar plugin unavailable on this platform; ignore.
  } finally {
    await SplashScreen.hide().catch(() => undefined);
  }
  // Initializes ads + ATT when ads are enabled; a no-op otherwise.
  await initializeAds().catch(() => undefined);
}
