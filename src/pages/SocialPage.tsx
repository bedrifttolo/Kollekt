import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eyebrow } from '../components/ui-kit';
import RanksPanel from './social/RanksPanel';
import GamesPanel from './social/GamesPanel';

export default function SocialPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ranks' | 'games'>('ranks');

  return (
    <div className="space-y-5 pt-3 pb-6">
      <div>
        <Eyebrow>{t('social.eyebrow')}</Eyebrow>
        <h2 className="mt-2 display-lg">
          {t('social.title')}
        </h2>
      </div>

      <div className="seg">
        {(['ranks', 'games'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 rounded-[.85rem] py-2.5 text-sm font-bold transition-all ${
              tab === value ? 'bg-primary text-primary-foreground dark:bg-white dark:text-black' : 'text-muted-foreground'
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
