import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { Browser } from '@capacitor/browser';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Promotion } from '../lib/types';

const SWIPE_THRESHOLD = 60;

export default function PromoSlider() {
  const { t: translate } = useTranslation();
  const [items, setItems] = useState<Promotion[]>([]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    api.get<Promotion[]>('/promotions')
      .then((list) => setItems(list))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  const active = items[Math.min(index, items.length - 1)];

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, items.length - 1));
    if (clamped === index) return;
    setDirection(clamped > index ? 1 : -1);
    setIndex(clamped);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_THRESHOLD) goTo(index + 1);
    else if (info.offset.x >= SWIPE_THRESHOLD) goTo(index - 1);
  };

  const openCta = (url: string) => {
    if (url.startsWith('https://')) void Browser.open({ url });
    else window.open(url, '_blank');
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{translate('dashboard.promosTitle')}</h3>
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={active.id}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction >= 0 ? -40 : 40 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
            drag={items.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="househero cursor-grab active:cursor-grabbing"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white">{active.category}</span>
              {active.dateLabel && <span className="text-xs font-medium text-white/70">{active.dateLabel}</span>}
            </div>
            <h4 className="font-display text-2xl font-extrabold leading-tight text-white">{active.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{active.body}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              {active.location ? (
                <div className="flex min-w-0 items-center gap-2 text-white/85">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm">{active.location}</span>
                </div>
              ) : (
                <span />
              )}
              {active.ctaLabel && active.ctaUrl && (
                <button
                  onClick={() => openCta(active.ctaUrl as string)}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-bold text-primary"
                >
                  {active.ctaLabel}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {items.map((promo, i) => (
            <button
              key={promo.id}
              onClick={() => goTo(i)}
              aria-label={translate('dashboard.promoGoTo', { index: i + 1 })}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-primary' : 'w-2 bg-muted'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
