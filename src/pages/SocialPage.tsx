import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eyebrow } from '../components/ui-kit';
import { PAGE_ACCENTS } from '../lib/pageAccent';
import RanksPanel from './social/RanksPanel';
import GamesPanel from './social/GamesPanel';

export default function SocialPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ranks' | 'games'>('ranks');

  return (
    <div className="space-y-4 pt-3">
      <div>
        <Eyebrow accent={PAGE_ACCENTS['/social']}>{t('social.eyebrow')}</Eyebrow>
        <h2 className="mt-2 display-md">
          {t('social.title')}
        </h2>
      </div>

      <div className="seg">
        {(['ranks', 'games'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-[.85rem] py-2.5 text-sm font-bold transition-all ${
              tab === value ? 'bg-ink text-ink-foreground' : 'text-muted-foreground'
            }`}
          >
            {value === 'ranks' ? t('social.ranksTab') : t('social.gamesTab')}
          </button>
        ))}
      </div>

      {tab === 'ranks' ? <RanksPanel /> : <GamesPanel />}
    </div>
  );
}
