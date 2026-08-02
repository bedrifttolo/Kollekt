import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePremiumEntitlement } from '../lib/purchases';

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
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={onClose}>
      <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-secondary-foreground">{t('social.games.premium')}</p>
            <h3 className="mt-1 font-display text-xl font-extrabold">{t('social.games.paywall.title')}</h3>
          </div>
          <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted" aria-label={t('common.cancel')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('social.games.paywall.body')}</p>
        {notice && <p className="mt-2 text-xs font-semibold text-primary">{notice}</p>}
        <button
          onClick={() => void handlePurchase()}
          disabled={busy}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-ink-foreground disabled:opacity-50"
        >
          {priceString ? t('social.games.paywall.unlockFor', { price: priceString }) : t('social.games.paywall.unlock')}
        </button>
        <button
          onClick={() => void handleRestore()}
          disabled={busy}
          className="mt-2 min-h-11 w-full text-center text-xs font-semibold text-primary disabled:opacity-50"
        >
          {t('social.games.paywall.restore')}
        </button>
        <p className="mt-3 text-[10px] leading-snug text-muted-foreground">{t('social.games.paywall.disclosure')}</p>
        {!available && <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{t('social.games.paywall.unavailable')}</p>}
      </div>
    </div>
  );
}
