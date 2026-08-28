"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  messages,
  type Locale,
  type TranslationKey,
  type TranslationParams,
} from "./messages"

const LANGUAGE_KEY = "mini_drama_language"

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function isLocale(value: string | null): value is Locale {
  return value === "zh" || value === "en"
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh")

  useEffect(() => {
    const savedLocale = localStorage.getItem(LANGUAGE_KEY)
    if (isLocale(savedLocale)) setLocaleState(savedLocale)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    localStorage.setItem(LANGUAGE_KEY, nextLocale)
  }, [])

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => {
      const template = messages[locale][key]
      if (!params) return template

      return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
        const value = params[name]
        return value === undefined ? placeholder : String(value)
      })
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error("useI18n must be used within I18nProvider")
  return context
}
