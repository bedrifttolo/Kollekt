import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'kollekt-language';
export const SUPPORTED_LANGUAGES = ['en', 'no', 'sv', 'da'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Locale bundles are code-split: the app downloads only the active language (plus the
// Norwegian fallback) at boot instead of shipping all four in the main chunk.
const localeLoaders: Record<SupportedLanguage, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('./locales/en.json'),
  no: () => import('./locales/no.json'),
  sv: () => import('./locales/sv.json'),
  da: () => import('./locales/da.json'),
};

const loadedLanguages = new Set<SupportedLanguage>();

/** Loads a locale bundle into i18next. Call before changeLanguage to avoid a key flash. */
export async function loadLanguage(language: SupportedLanguage): Promise<void> {
  if (loadedLanguages.has(language)) return;
  const bundle = await localeLoaders[language]();
  i18n.addResourceBundle(language, 'translation', bundle.default, true, true);
  loadedLanguages.add(language);
}

function normalizeLanguage(value: string | null): SupportedLanguage | null {
  if (!value) return null;
  const base = value.toLowerCase().split('-')[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as SupportedLanguage) : null;
}

// Mirrors the localStorage-only detection configured below; needed before init so the
// right locale chunk(s) can be fetched up front.
const initialLanguage =
  normalizeLanguage(typeof localStorage === 'undefined' ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY)) ?? 'no';

const initialResources: Partial<Record<SupportedLanguage, { translation: Record<string, unknown> }>> = {};
// Top-level await: the locale chunks are same-origin (on native, on-disk) and tiny, so
// waiting here is imperceptible and guarantees the first render is fully translated.
for (const language of new Set<SupportedLanguage>([initialLanguage, 'no'])) {
  const bundle = await localeLoaders[language]();
  initialResources[language] = { translation: bundle.default };
  loadedLanguages.add(language);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: initialResources,
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
