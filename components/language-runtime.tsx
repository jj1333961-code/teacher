'use client'

import { useEffect } from 'react'
import { translate, type Locale } from '@/lib/i18n'

export function LanguageRuntime() {
  useEffect(() => {
    let locale: Locale = localStorage.getItem('lang') === 'en' ? 'en' : 'ar'
    const originals = new WeakMap<Text, string>()
    const attrs = ['placeholder', 'title', 'aria-label', 'aria-description']
    let applying = false
    const apply = () => {
      if (applying) return
      applying = true
      document.documentElement.lang = locale
      document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl'
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node as Text
        if (!text.nodeValue?.trim() || text.parentElement?.closest('script,style,pre,code')) continue
        if (!originals.has(text)) originals.set(text, text.nodeValue)
        text.nodeValue = translate(originals.get(text) ?? text.nodeValue, locale)
      }
      document.querySelectorAll<HTMLElement>('*').forEach((element) => attrs.forEach((attr) => {
        const originalAttr = `data-i18n-original-${attr}`
        if (!element.hasAttribute(originalAttr) && element.hasAttribute(attr)) element.setAttribute(originalAttr, element.getAttribute(attr) ?? '')
        if (element.hasAttribute(originalAttr)) element.setAttribute(attr, translate(element.getAttribute(originalAttr) ?? '', locale))
      }))
      applying = false
    }
    const toggle = () => { locale = locale === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', locale); apply() }
    window.addEventListener('languagechange', toggle)
    const observer = new MutationObserver(() => apply())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    apply()
    return () => { observer.disconnect(); window.removeEventListener('languagechange', toggle) }
  }, [])
  return null
}
