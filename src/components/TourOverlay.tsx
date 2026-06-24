import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

export type TourStep = { route?: string; selector: string; titleKey: string; bodyKey: string };

const PAD = 8;

export default function TourOverlay({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Show the guide only the very first time this user reaches the app, then never again.
  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    const id = window.setTimeout(() => {
      setActive(true);
      localStorage.setItem(storageKey, '1');
    }, 600);
    return () => window.clearTimeout(id);
  }, [storageKey]);

  const step = steps[index];

  // Walk the user through the real pages: navigate to the step's route as the step changes.
  // Steps without a route (e.g. the single-page onboarding tour) stay where they are.
  useEffect(() => {
    if (!active || !step?.route) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [active, step, location.pathname, navigate]);

  // Bring the target into view, then keep the highlight aligned through scroll/resize.
  useLayoutEffect(() => {
    if (!active || !step) return;
    const target = document.querySelector(step.selector);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const measure = () => {
      const el = document.querySelector(step.selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const settle = window.setTimeout(measure, 360);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, index, step]);

  if (!active || !step) return null;

  const finish = () => {
    localStorage.setItem(storageKey, '1');
    setActive(false);
  };
  const next = () => (index < steps.length - 1 ? setIndex((i) => i + 1) : finish());

  const isLast = index === steps.length - 1;
  const highlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;
  const tooltipBelow = rect ? rect.top < window.innerHeight / 2 : true;
  const tooltipStyle: React.CSSProperties = highlight
    ? tooltipBelow
      ? { top: highlight.top + highlight.height + 14 }
      : { bottom: window.innerHeight - highlight.top + 14 }
    : { top: '40%' };

  return createPortal(
    <div className="fixed inset-0 z-[999]" role="dialog" aria-modal="true">
      {/* Transparent catcher blocks interaction with the page underneath. */}
      <div className="absolute inset-0" onClick={next} />

      {highlight && (
        <div
          className="absolute rounded-2xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow:
              '0 0 0 2px rgba(244,222,114,0.95), 0 0 22px 6px rgba(244,222,114,0.55), 0 0 0 9999px rgba(6,18,12,0.82)',
          }}
        />
      )}

      <div
        className="absolute left-1/2 -translate-x-1/2 w-[min(20rem,90vw)] glass-strong rounded-2xl p-4 text-center shadow-xl"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-secondary mb-1">
          {index + 1} / {steps.length}
        </p>
        <p className="font-display text-lg font-extrabold mb-1">{t(step.titleKey)}</p>
        <p className="text-sm text-muted-foreground mb-3">{t(step.bodyKey)}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={finish} className="px-3 py-2 text-sm font-medium text-muted-foreground">
            {t('tour.skip')}
          </button>
          <button onClick={next} className="btn-lemon px-5 py-2 text-sm font-semibold">
            {isLast ? t('tour.done') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
