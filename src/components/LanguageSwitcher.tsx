import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../context/UserContext';
import { loadLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';
import { api } from '../lib/api';
import { cn } from './ui/utils';

const languageLabels: Record<SupportedLanguage, string> = {
  en: 'EN',
  no: 'NO',
  sv: 'SV',
  da: 'DA',
};

export default function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const { currentUser } = useUser();
  const currentLanguage = (SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage as SupportedLanguage)
    ? i18n.resolvedLanguage
    : 'no') as SupportedLanguage;

  return (
    <div
      className={cn('glass inline-flex shrink-0 items-center gap-1 rounded-xl p-1', className)}
      role="group"
      aria-label={t('languageSwitcher.ariaLabel')}
    >
      <span className="sr-only">{t('languageSwitcher.label')}</span>
      <Languages className="ml-1 hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      {SUPPORTED_LANGUAGES.map((language) => {
        const isActive = language === currentLanguage;
        return (
          <button
            key={language}
            type="button"
            onClick={() => {
              void loadLanguage(language)
                .catch(() => undefined)
                .then(() => i18n.changeLanguage(language));
              // Best-effort: this only feeds which language push notifications are composed
              // in server-side. The UI's own language always comes from localStorage above,
              // so a failed save here has no visible effect for the user.
              if (currentUser?.name) {
                void api.patch('/members/language', { memberName: currentUser.name, language }).catch(() => undefined);
              }
            }}
            aria-pressed={isActive}
            aria-label={t(`languages.${language}`)}
            title={t(`languages.${language}`)}
            // A real 44px-tall target rather than a .pressable-tight one: four of these sit 4px
            // apart, and grown hit areas that close would overlap, with the last in DOM order
            // swallowing taps meant for its neighbour. 40px wide keeps the whole strip at ~180px,
            // which still fits the Profile row beside its label.
            className={cn(
              'flex min-h-11 min-w-10 shrink-0 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition-colors',
              isActive ? 'gradient-primary text-ink-foreground' : 'text-muted-foreground',
            )}
          >
            {languageLabels[language]}
          </button>
        );
      })}
    </div>
  );
}
