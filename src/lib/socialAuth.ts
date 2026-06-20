import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

export type SocialProvider = 'google' | 'apple';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const googleIosClientId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID?.trim() ?? '';
const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID?.trim() ?? '';
let initialized: Promise<void> | null = null;

export function getSocialProviders(): SocialProvider[] {
  const platform = Capacitor.getPlatform();
  const providers: SocialProvider[] = [];
  if (googleClientId && platform !== 'ios') providers.push('google');
  if (googleClientId && googleIosClientId && appleClientId && platform === 'ios') providers.push('google');
  if (appleClientId && platform === 'ios') providers.push('apple');
  return providers;
}

function initializeSocialLogin() {
  if (initialized) return initialized;
  const options: Parameters<typeof SocialLogin.initialize>[0] = {};
  if (googleClientId) {
    options.google = {
      webClientId: googleClientId,
      ...(googleIosClientId ? { iOSClientId: googleIosClientId, iOSServerClientId: googleClientId } : {}),
      mode: 'online',
    };
  }
  if (appleClientId) {
    options.apple = { clientId: appleClientId, useProperTokenExchange: true, useBroadcastChannel: true };
  }
  initialized = SocialLogin.initialize(options);
  return initialized;
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function getSocialIdentity(provider: SocialProvider) {
  await initializeSocialLogin();
  if (provider === 'google') {
    const response = await SocialLogin.login({ provider: 'google', options: { scopes: ['profile', 'email'] } });
    if (response.result.responseType !== 'online' || !response.result.idToken) throw new Error('Google did not return an identity token');
    return { idToken: response.result.idToken, displayName: response.result.profile.name ?? undefined };
  }

  const nonce = randomNonce();
  const response = await SocialLogin.login({ provider: 'apple', options: { scopes: ['name', 'email'], nonce, useBroadcastChannel: true } });
  if (!response.result.idToken) throw new Error('Apple did not return an identity token');
  const displayName = [response.result.profile.givenName, response.result.profile.familyName].filter(Boolean).join(' ') || undefined;
  return { idToken: response.result.idToken, nonce, displayName };
}
