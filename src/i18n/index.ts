import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import no from './locales/no.json';
import sv from './locales/sv.json';
import da from './locales/da.json';

export const LANGUAGE_STORAGE_KEY = 'kollekt-language';
export const SUPPORTED_LANGUAGES = ['en', 'no', 'sv', 'da'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: { translation: en },
  no: { translation: no },
  sv: { translation: sv },
  da: { translation: da },
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'no',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    returnNull: false,
    debug: false,
    detection: {
      // Only honour a language the user has explicitly chosen; a fresh install starts in
      // Norwegian (fallbackLng) rather than following the device locale.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

function syncDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
}

syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? 'no');
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
