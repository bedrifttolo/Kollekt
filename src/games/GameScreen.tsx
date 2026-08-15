import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSwipeBack } from '../lib/swipeBack';

/**
 * Full-screen shell for an in-app game.
 *
 * Games escape AppLayout with `fixed inset-0`, which makes each one responsible for its own safe
 * area — and index.html sets `viewport-fit=cover`, so the webview really does draw under the
 * notch. Six games shipped with only `p-5` here, which put their back button and title straight
 * through the iPhone status-bar clock. `safe-top`/`safe-bottom` (see globals.css) are the same
 * utilities AppHeader and the chat thread use.
 */
export function GameScreen({ children }: { children: ReactNode }) {
  return (
    <div className="safe-top safe-bottom fixed inset-0 z-[60] overflow-y-auto bg-background p-5">
      <div className="mx-auto max-w-md space-y-5">{children}</div>
    </div>
  );
}

/** Back button + eyebrow + title, identical across every game that has a top bar. */
export function GameHeader({
  eyebrow,
  title,
  onClose,
}: {
  eyebrow: string;
  title: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Leaving a game with a left-edge swipe closes it exactly like the button does.
  useSwipeBack(onClose);
  return (
    <div className="flex items-center gap-3">
      <button onClick={onClose} className="btn-ghost !p-3" aria-label={t('common.back')}>
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
      </div>
    </div>
  );
}
