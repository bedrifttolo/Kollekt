import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

// Registration foundation: requests permission, registers with APNs/FCM, sends the
// device token to the authenticated backend, and deep-links on notification taps.
// Actual push delivery requires APNs/FCM credentials configured separately.
let registeredToken: string | null = null;
let listenersBound = false;
const pushDebug = import.meta.env.VITE_DEBUG_PUSH === 'true';

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
        if (pushDebug) console.info('[push] registered device token', token.value);
        void api
          .post('/push/device-token', {
            token: token.value,
            platform: Capacitor.getPlatform(),
          })
          .then(() => {
            if (pushDebug) console.info('[push] device token saved');
          })
          .catch((error) => {
            if (pushDebug) console.warn('[push] device token save failed', error);
          });
      });
      await PushNotifications.addListener('registrationError', (error) => {
        if (pushDebug) console.warn('[push] registration failed', error);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const route = action.notification.data?.route;
        if (pushDebug) console.info('[push] notification tapped', action.notification.data);
        if (typeof route === 'string' && route.startsWith('/')) {
          window.location.assign(route);
        }
      });
    }

    await PushNotifications.register();
  } catch (error) {
    if (pushDebug) console.warn('[push] unavailable', error);
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
