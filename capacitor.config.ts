import type { CapacitorConfig } from '@capacitor/cli';

// Live-reload: when CAP_LIVE_RELOAD_URL is set during `cap sync`, the app loads the
// running Vite dev server instead of the bundled web build, so src/ edits hot-reload
// in the simulator. Leave it unset for normal/production builds.
const liveReloadUrl = process.env.CAP_LIVE_RELOAD_URL;

const config: CapacitorConfig = {
  appId: 'no.kollekt.app',
  appName: 'Kollekt',
  webDir: 'dist',
  ...(liveReloadUrl ? { server: { url: liveReloadUrl, cleartext: true } } : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#F1EEE2',
      showSpinner: false,
    },
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;
