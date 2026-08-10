import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { api } from '../lib/api';
import { compareVersions } from '../lib/appVersion';
import type { AppVersionInfo } from '../lib/types';

// Module-scope, not localStorage: it must reset on every fresh app launch (new JS context) so
// the overlay reappears "every time they access the app until they update", but stay dismissed
// for the rest of the current session once the user taps Wait.
let dismissedThisSession = false;

export default function UpdateOverlay() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // iOS only for now — no Play Store listing yet. Extending to Android later just means
    // adding an 'android' branch here plus the matching backend fields.
    if (Capacitor.getPlatform() !== 'ios' || dismissedThisSession) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ App }, versionInfo] = await Promise.all([
          import('@capacitor/app'),
          api.get<AppVersionInfo>('/app-version'),
        ]);
        const { version } = await App.getInfo();
        if (cancelled) return;
        if (compareVersions(version, versionInfo.latestIosVersion) < 0) {
          setInfo(versionInfo);
          setVisible(true);
        }
      } catch {
        // A failed version check must never block app usage.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || !info) return null;

  const wait = () => {
    dismissedThisSession = true;
    setVisible(false);
  };

  const update = async () => {
    await Browser.open({ url: info.iosStoreUrl });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl p-6 text-center max-w-sm w-full shadow-xl">
          <p className="font-display text-lg font-extrabold mb-2">{t('appUpdate.title')}</p>
          <p className="text-sm text-muted-foreground mb-5">{t('appUpdate.body')}</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={wait} className="px-4 py-2 text-sm font-medium text-muted-foreground">
              {t('appUpdate.wait')}
            </button>
            <button onClick={update} className="btn-lemon px-5 py-2 text-sm font-semibold">
              {t('appUpdate.update')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
