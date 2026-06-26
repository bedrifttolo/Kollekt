import { Capacitor } from '@capacitor/core';

// AdMob integration layer.
//
// INERT until three external things exist:
//   1. A Google AdMob account with an App ID and ad-unit IDs.
//   2. The native plugin installed: `npm i @capacitor-community/admob` (then `npx cap sync`).
//   3. iOS Info.plist `GADApplicationIdentifier` set to your real AdMob App ID, plus the
//      `NSUserTrackingUsageDescription` + `SKAdNetworkItems` keys (the latter two are already
//      added). Android needs the App ID in `AndroidManifest.xml`.
//
// To go live:
//   - install the plugin, fill in the IDs below, set `ADS_ENABLED = true`
//   - implement the three bodies against the plugin (import is intentionally omitted now so the
//     build doesn't depend on an uninstalled package).
//
// Until then every function is a safe no-op: no SDK init, no ATT prompt, no ad requests.

export const ADS_ENABLED = false;

/** Replace with your real AdMob ad-unit ids before enabling. */
export const AD_UNITS = {
  homeBannerIos: 'ca-app-pub-0000000000000000/0000000000',
  homeBannerAndroid: 'ca-app-pub-0000000000000000/0000000000',
};

let initialized = false;

/**
 * Initializes the AdMob SDK and (on iOS 14+) requests App Tracking Transparency consent.
 * Personalized ads require consent; without it AdMob must serve non-personalized ads.
 */
export async function initializeAds(): Promise<void> {
  if (!ADS_ENABLED || initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;
  // import { AdMob } from '@capacitor-community/admob';
  // const { status } = await AdMob.trackingAuthorizationStatus();
  // if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
  // await AdMob.initialize({ requestTrackingAuthorization: false });
}

/** Shows the home-screen banner (anchored above the bottom nav). */
export async function showHomeBanner(): Promise<void> {
  if (!ADS_ENABLED || !Capacitor.isNativePlatform()) return;
  // import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob';
  // await AdMob.showBanner({
  //   adId: Capacitor.getPlatform() === 'ios' ? AD_UNITS.homeBannerIos : AD_UNITS.homeBannerAndroid,
  //   adSize: BannerAdSize.ADAPTIVE_BANNER,
  //   position: BannerAdPosition.BOTTOM_CENTER,
  //   margin: 96, // clear the bottom nav
  // });
}

/** Removes the banner (call when leaving the home screen). */
export async function hideHomeBanner(): Promise<void> {
  if (!ADS_ENABLED || !Capacitor.isNativePlatform()) return;
  // import { AdMob } from '@capacitor-community/admob';
  // await AdMob.removeBanner();
}
