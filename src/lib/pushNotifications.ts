import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

// Registration foundation: requests permission, registers with APNs/FCM, sends the
// device token to the authenticated backend, and deep-links on notification taps.
// Actual push delivery requires APNs/FCM credentials configured separately.
let registeredToken: string | null = null;
let listenersBound = false;

async function installedAppVersion(): Promise<string | undefined> {
  try {
    const { App } = await import('@capacitor/app');
    return (await App.getInfo()).version;
  } catch {
    // Plugin unavailable; registering without the version is better than not registering.
    return undefined;
  }
}

export async function registerPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      // First login on this device: ask the user. Without this the permission dialog
      // never appears and push can never activate.
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') return;

    if (!listenersBound) {
      listenersBound = true;
      await PushNotifications.addListener('registration', (token) => {
        registeredToken = token.value;
        // The installed version rides along so the backend can tell stale installs apart later.
        // Resolving it must never cost us the token itself, so a failure falls back to omitting it.
        void installedAppVersion()
          .then((appVersion) =>
            api.post('/push/device-token', {
              token: token.value,
              platform: Capacitor.getPlatform(),
              appVersion,
            }),
          )
          .catch(() => {
            // Token save is best-effort; the next login re-registers and tries again.
          });
      });
      await PushNotifications.addListener('registrationError', () => {
        // APNs/FCM refused registration; the app works without push.
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const route = action.notification.data?.route;
        if (typeof route === 'string' && route.startsWith('/')) {
          window.location.assign(route);
        }
      });
    }

    await PushNotifications.register();
  } catch {
    // Push unavailable on this build (e.g. missing Firebase config); continue without it.
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  try {
    await api.delete(`/push/device-token?token=${encodeURIComponent(token)}`);
  } catch {
    // Best-effort cleanup on logout.
  }
}
