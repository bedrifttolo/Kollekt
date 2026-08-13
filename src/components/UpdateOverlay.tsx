import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { api } from '../lib/api';
import { onAppResume } from '../lib/appLifecycle';
import { compareVersions } from '../lib/appVersion';
import type { AppVersionInfo } from '../lib/types';

// Module-scope, not localStorage: it must reset on every fresh app launch (new JS context) so the
// prompt reappears until the user actually updates. It decays rather than lasting the whole session
// because an iOS webview session can stay warm for days — a single "Wait" tap must not be able to
// silence the prompt indefinitely, or the resume re-check below buys nothing.
let dismissedAt: number | null = null;
const DISMISSAL_WINDOW_MS = 6 * 60 * 60 * 1000;

type Prompt = { storeUrl: string; forced: boolean };

function recentlyDismissed(): boolean {
  return dismissedAt !== null && Date.now() - dismissedAt < DISMISSAL_WINDOW_MS;
}

export default function UpdateOverlay() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Note the dismissal is *not* checked before fetching. Bailing out early on a dismissal would
    // mean a user who tapped "Wait" could never discover that the version floor has since been
    // raised — a forced update has to win over a prior dismissal, so decide after the fetch.
    const check = async () => {
      const platform = Capacitor.getPlatform();
      if (platform !== 'ios' && platform !== 'android') return;
      try {
        const [{ App }, info] = await Promise.all([
          import('@capacitor/app'),
          api.get<AppVersionInfo>('/app-version'),
        ]);
        const { version } = await App.getInfo();
        if (cancelled) return;

        // Defaults of '0' matter: a client can outlive the backend it talks to, and an older
        // backend omits these fields entirely. '0' compares less than any real version, so a
        // missing floor means "not forced" rather than an exception that kills the whole check.
        const { latest, min, storeUrl } =
          platform === 'android'
            ? {
                latest: info.latestAndroidVersion ?? '0',
                min: info.minAndroidVersion ?? '0',
                storeUrl: info.androidStoreUrl ?? '',
              }
            : {
                latest: info.latestIosVersion,
                min: info.minIosVersion ?? '0',
                storeUrl: info.iosStoreUrl,
              };
        if (!storeUrl) return;

        const forced = compareVersions(version, min) < 0;
        const outdated = compareVersions(version, latest) < 0;
        if (forced || (outdated && !recentlyDismissed())) {
          setPrompt({ storeUrl, forced });
        }
      } catch (error) {
        // A failed version check must never block app usage — but it must not be invisible
        // either. A silent catch here is how a CORS block or a timeout turns into "the update
        // prompt just never appeared" with nothing to debug.
        console.warn('Update check failed', error);
      }
    };

    void check();
    // Re-check on resume: a native session can survive for days without a cold start, and a user
    // who never fully quits the app would otherwise never see the prompt at all.
    const unsubscribe = onAppResume(() => {
      void check();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!prompt) return null;

  const wait = () => {
    dismissedAt = Date.now();
    setPrompt(null);
  };

  const update = async () => {
    await Browser.open({ url: prompt.storeUrl });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl p-6 text-center max-w-sm w-full shadow-xl">
          <p className="font-display text-lg font-extrabold mb-2">
            {t(prompt.forced ? 'appUpdate.titleRequired' : 'appUpdate.title')}
          </p>
          <p className="text-sm text-muted-foreground mb-5">
            {t(prompt.forced ? 'appUpdate.bodyRequired' : 'appUpdate.body')}
          </p>
          <div className="flex items-center justify-center gap-2">
            {/* No way out when forced: the backdrop has no click handler and iOS has no hardware
                back button, so omitting this button is enough to make the dialog non-dismissable. */}
            {!prompt.forced && (
              <button onClick={wait} className="px-4 py-2 text-sm font-medium text-muted-foreground">
                {t('appUpdate.wait')}
              </button>
            )}
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
