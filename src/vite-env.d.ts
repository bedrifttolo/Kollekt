/// <reference types="vite/client" />

declare module 'canvas-confetti';

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_IOS_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_TERMS_URL?: string;
  readonly VITE_PRIVACY_URL?: string;
  readonly VITE_ENABLE_ADS?: string;
  readonly VITE_ADMOB_HOME_BANNER_IOS?: string;
  readonly VITE_ADMOB_HOME_BANNER_ANDROID?: string;
}
