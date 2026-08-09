import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'kollekt-language';
export const SUPPORTED_LANGUAGES = ['en', 'no', 'sv', 'da'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Locale bundles are code-split: the app downloads only the active language (plus the
// English fallback) at boot instead of shipping all four in the main chunk.
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

// Norwegian devices report `nb`/`nb-NO` (Bokmål) or `nn`/`nn-NO` (Nynorsk) as their system
// language, never the app's `no` code, so both alias to it here.
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = { nb: 'no', nn: 'no' };

function normalizeLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) return null;
  const base = value.toLowerCase().split('-')[0];
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(base)) return base as SupportedLanguage;
  return LANGUAGE_ALIASES[base] ?? null;
}

function detectDeviceLanguage(): SupportedLanguage | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = navigator.languages && navigator.languages.length > 0 ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }
  return null;
}

// Mirrors the detection order configured below (localStorage, then device locale); needed
// before init so the right locale chunk(s) can be fetched up front. A device locale outside
// en/no/sv/da falls back to English rather than Norwegian.
const storedLanguage = normalizeLanguage(
  typeof localStorage === 'undefined' ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY),
);
const initialLanguage = storedLanguage ?? detectDeviceLanguage() ?? 'en';

const initialResources: Partial<Record<SupportedLanguage, { translation: Record<string, unknown> }>> = {};
// Top-level await: the locale chunks are same-origin (on native, on-disk) and tiny, so
// waiting here is imperceptible and guarantees the first render is fully translated.
for (const language of new Set<SupportedLanguage>([initialLanguage, 'en'])) {
  const bundle = await localeLoaders[language]();
  initialResources[language] = { translation: bundle.default };
  loadedLanguages.add(language);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: initialResources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    returnNull: false,
    debug: false,
    detection: {
      // An explicit choice (localStorage) always wins; a fresh install falls back to the
      // device locale, then to English (fallbackLng) if that locale isn't supported.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      convertDetectedLanguage: (lng: string) => {
        const base = lng.toLowerCase().split('-')[0];
        return LANGUAGE_ALIASES[base] ?? lng;
      },
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

syncDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? 'en');
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
