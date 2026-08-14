import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePremiumEntitlement } from '../lib/purchases';
import { Sheet } from './ui-kit';

interface SubscriptionPaywallProps {
  onClose: () => void;
}

/** True when the RevenueCat plugin reports the user dismissed the native purchase sheet. */
function isUserCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'userCancelled' in error
    && (error as { userCancelled?: boolean }).userCancelled === true;
}

/** Shared paywall for the single premium entitlement gating both the game hub and chat GIFs. */
export default function SubscriptionPaywall({ onClose }: SubscriptionPaywallProps) {
  const { t } = useTranslation();
  const { available, priceString, purchase, restore } = usePremiumEntitlement();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 1800);
  };

  const handlePurchase = async () => {
    if (!available) { flash(t('social.games.paywall.unavailable')); return; }
    setBusy(true);
    try {
      const ok = await purchase();
      if (ok) onClose();
    } catch (error) {
      if (!isUserCancelled(error)) flash(t('social.games.paywall.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!available) { flash(t('social.games.paywall.unavailable')); return; }
    setBusy(true);
    try {
      const ok = await restore();
      if (ok) onClose();
      else flash(t('social.games.paywall.nothingToRestore'));
    } catch {
      flash(t('social.games.paywall.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-secondary-foreground">{t('social.games.premium')}</p>
          <h3 className="mt-1 font-display text-xl font-extrabold">{t('social.games.paywall.title')}</h3>
        </div>
      }
      footer={
        <>
          <button
            onClick={() => void handlePurchase()}
            disabled={busy}
            className="btn-pine w-full disabled:opacity-50"
          >
            {priceString ? t('social.games.paywall.unlockFor', { price: priceString }) : t('social.games.paywall.unlock')}
          </button>
          <button
            onClick={() => void handleRestore()}
            disabled={busy}
            className="mt-2 min-h-11 w-full text-center text-sm font-semibold text-primary disabled:opacity-50"
          >
            {t('social.games.paywall.restore')}
          </button>
          {/* Apple requires the price, term and restore path to be visible on the paywall itself. */}
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{t('social.games.paywall.disclosure')}</p>
          {!available && <p className="mt-2 text-[11px] font-semibold text-muted-foreground">{t('social.games.paywall.unavailable')}</p>}
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{t('social.games.paywall.body')}</p>
      {notice && <p className="mt-2 text-xs font-semibold text-primary">{notice}</p>}
    </Sheet>
  );
}
