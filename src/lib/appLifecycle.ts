import { Capacitor } from '@capacitor/core';
import { ensureFreshAccessToken } from './api';

/**
 * Runs work when the app comes back to the foreground.
 *
 * Nothing used to listen for this at all: an iOS app resumed after hours in the background sat
 * with a long-expired access token and a dead WebSocket until the user happened to trigger a
 * request, which then 401'd. Refreshing on resume is what makes a session feel permanent rather
 * than merely long-lived.
 *
 * @capacitor/app covers native; visibilitychange covers the web build and is also the signal
 * that fires when the user returns from a payment app in the in-app browser.
 */
type ResumeHandler = () => void;

const handlers = new Set<ResumeHandler>();
let started = false;

function notifyResume(): void {
  // Get the token healthy before the handlers start issuing requests off the back of it.
  void ensureFreshAccessToken()
    .catch(() => undefined)
    .finally(() => {
      handlers.forEach((handler) => {
        try {
          handler();
        } catch {
          // One bad listener must not stop the others from resuming.
        }
      });
    });
}

async function start(): Promise<void> {
  if (started) return;
  started = true;

  if (Capacitor.isNativePlatform()) {
    try {
      const { App } = await import('@capacitor/app');
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) notifyResume();
      });
    } catch {
      // Plugin unavailable in this build; the visibility listener below still applies.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') notifyResume();
  });
}

/** Registers `handler` to run whenever the app is foregrounded. Returns an unsubscribe function. */
export function onAppResume(handler: ResumeHandler): () => void {
  handlers.add(handler);
  void start();
  return () => {
    handlers.delete(handler);
  };
}
