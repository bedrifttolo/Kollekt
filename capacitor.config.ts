import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'no.kollekt.app',
  appName: 'Kollekt',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // The web layer already owns its layout via html.keyboard-open (AppLayout), so let the
      // native shell resize the web view rather than shifting the whole window — otherwise the
      // chat header slides off the top when the keyboard opens.
      resize: KeyboardResize.Native,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#F7F2EC',
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
