/**
 * Where the Terms of Use and Privacy Policy live.
 *
 * These are the only two links on the login screen, and App Store review rejects builds that offer
 * Sign in with Apple or a subscription without reachable versions of both — so they must resolve to
 * real published pages before the next submission.
 *
 * Set VITE_TERMS_URL / VITE_PRIVACY_URL to override per environment; the constants below are the
 * single place to change the default. They are deliberately absolute: the links open in the
 * in-app browser on native, where a relative path would resolve against the capacitor:// origin.
 */
const DEFAULT_TERMS_URL = 'https://kollekt.no/terms';
const DEFAULT_PRIVACY_URL = 'https://kollekt.no/privacy';

export const TERMS_URL = import.meta.env.VITE_TERMS_URL?.trim() || DEFAULT_TERMS_URL;
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL?.trim() || DEFAULT_PRIVACY_URL;
