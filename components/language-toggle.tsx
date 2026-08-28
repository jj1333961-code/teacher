'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getLocale, t } from '@/lib/i18n'

export function LanguageToggle() {
  const [locale, setLocale] = useState<'ar' | 'en'>('ar')
  useEffect(() => {
    const sync = () => setLocale(getLocale(localStorage.getItem('lang')))
    sync()
    window.addEventListener('languagechange', sync)
    return () => window.removeEventListener('languagechange', sync)
  }, [])
  return <Button variant="outline" size="sm" aria-label={locale === 'ar' ? t('common.switchToEnglish', locale) : t('common.switchToArabic', locale)} onClick={() => { const next = locale === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', next); window.dispatchEvent(new Event('languagechange')); setLocale(next) }}>{locale === 'ar' ? 'EN' : 'ع'}</Button>
}
