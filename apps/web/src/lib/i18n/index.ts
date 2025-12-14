import { en } from './en'
import { ja } from './ja'

type TranslationKey = keyof typeof en

const translations = { en, ja } as const

// Get current language from browser
function getLanguage(): 'ja' | 'en' {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language || ''
  return lang.startsWith('ja') ? 'ja' : 'en'
}

// Translation function
export function t(key: TranslationKey): string {
  const lang = getLanguage()
  return translations[lang][key] || translations.en[key]
}

export { getLanguage }
