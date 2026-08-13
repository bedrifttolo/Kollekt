import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'no.kollekt.app',
  appName: 'Kollekt',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      // The web layer owns keyboard layout end to end (src/lib/keyboardInsets.ts publishes
      // --keyboard-inset from keyboardWillShow; globals.css consumes it). The native resize modes
      // are all worse here: `native` defers its webview setFrame until keyboardAnimationDuration
      // + 0.2s and then applies it unanimated, so the composer arrives ~450ms after the keyboard,
      // and `body`/`ionic` shift the whole window so the chat header slides off the top.
      resize: KeyboardResize.None,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
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
