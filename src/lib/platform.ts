import { Capacitor } from '@capacitor/core';

/** True on the native iOS app; false on Android and web. */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** True on the native Android app; false on iOS and web. */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}
