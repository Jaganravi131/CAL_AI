import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import de from '../locales/de.json'
import hi from '../locales/hi.json'

const LANG_KEY = 'app_language'

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'hi'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'हिन्दी',
}

let _initialized = false

export async function initI18n() {
  if (_initialized) return
  _initialized = true

  const saved      = await AsyncStorage.getItem(LANG_KEY)
  const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en'
  const initial: Locale =
    (saved as Locale) ??
    (SUPPORTED_LOCALES.includes(deviceLang as Locale) ? (deviceLang as Locale) : 'en')

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      hi: { translation: hi },
    },
    lng:           initial,
    fallbackLng:   'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  })
}

export async function setLanguage(locale: Locale) {
  await AsyncStorage.setItem(LANG_KEY, locale)
  await i18n.changeLanguage(locale)
}

export function getCurrentLocale(): Locale {
  return (i18n.language as Locale) ?? 'en'
}

export default i18n
