import { Capacitor } from '@capacitor/core';

const ADS_ENABLED = import.meta.env.VITE_ENABLE_ADS === 'true';

const AD_UNITS = {
  ios: import.meta.env.VITE_ADMOB_HOME_BANNER_IOS ?? '',
  android: import.meta.env.VITE_ADMOB_HOME_BANNER_ANDROID ?? '',
};

let initialized = false;
let initializing: Promise<void> | null = null;

/**
 * Initializes the AdMob SDK and (on iOS 14+) requests App Tracking Transparency consent.
 * Personalized ads require consent; without it AdMob must serve non-personalized ads.
 */
export async function initializeAds(): Promise<void> {
  if (!ADS_ENABLED || initialized || !Capacitor.isNativePlatform()) return;
  if (!initializing) {
    initializing = (async () => {
      const { AdMob } = await import('@capacitor-community/admob');
      if (Capacitor.getPlatform() === 'ios') {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      }
      await AdMob.initialize();
      initialized = true;
    })().finally(() => {
      initializing = null;
    });
  }
  await initializing;
}

/** Shows the home-screen banner (anchored above the bottom nav). */
export async function showHomeBanner(): Promise<void> {
  if (!ADS_ENABLED || !Capacitor.isNativePlatform()) return;
  const platform = Capacitor.getPlatform();
  const adId = platform === 'ios' ? AD_UNITS.ios : AD_UNITS.android;
  if (!adId) return;
  await initializeAds();
  const { AdMob, BannerAdPosition, BannerAdSize } = await import('@capacitor-community/admob');
  await AdMob.showBanner({
    adId,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 96,
  });
}

/** Removes the banner (call when leaving the home screen). */
export async function hideHomeBanner(): Promise<void> {
  if (!ADS_ENABLED || !Capacitor.isNativePlatform()) return;
  const { AdMob } = await import('@capacitor-community/admob');
  await AdMob.removeBanner();
}
