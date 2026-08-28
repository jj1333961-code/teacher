'use client'

import { useEffect } from 'react'
import { getLocale, translate, validateDictionaries, type Locale } from '@/lib/i18n'

export function LanguageRuntime() {
  useEffect(() => {
    let locale: Locale = getLocale(localStorage.getItem('lang'))
    const dictionaryStatus = validateDictionaries()
    if (process.env.NODE_ENV !== 'production' && (dictionaryStatus.missingInEnglish.length || dictionaryStatus.missingInArabic.length)) console.warn('[i18n] Complete both locale dictionaries before release', dictionaryStatus)
    const originals = new WeakMap<Text, string>()
    const attrs = ['placeholder', 'title', 'aria-label', 'aria-description']
    let applying = false
    let frame = 0
    const apply = (root: ParentNode = document.body, full = false) => {
      if (applying) return
      applying = true
      document.documentElement.lang = locale
      document.documentElement.dir = locale === 'en' ? 'ltr' : 'rtl'
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node as Text
        if (!text.nodeValue?.trim() || text.parentElement?.closest('script,style,pre,code')) continue
        if (!originals.has(text)) originals.set(text, text.nodeValue)
        text.nodeValue = translate(originals.get(text) ?? text.nodeValue, locale)
      }
      const elements = full ? document.querySelectorAll<HTMLElement>('*') : root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>('*')] : []
      elements.forEach((element) => attrs.forEach((attr) => {
        const originalAttr = `data-i18n-original-${attr}`
        if (!element.hasAttribute(originalAttr) && element.hasAttribute(attr)) element.setAttribute(originalAttr, element.getAttribute(attr) ?? '')
        if (element.hasAttribute(originalAttr)) element.setAttribute(attr, translate(element.getAttribute(originalAttr) ?? '', locale))
      }))
      applying = false
      observer.takeRecords()
    }
    const schedule = (root?: ParentNode, full = false) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => apply(root, full)) }
    const syncExternalLocale = () => { locale = getLocale(localStorage.getItem('lang')); schedule(document.body, true) }
    const toggle = () => { locale = locale === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', locale); document.cookie = `lang=${locale}; Max-Age=31536000; Path=/; SameSite=Lax`; schedule(document.body, true) }
    window.addEventListener('languagechange', toggle)
    window.addEventListener('storage', (event) => { if (event.key === 'lang') syncExternalLocale() })
    const observer = new MutationObserver((mutations) => { const added = mutations.find((mutation) => mutation.addedNodes.length)?.addedNodes[0]; if (added instanceof Element) schedule(added) })
    observer.observe(document.body, { childList: true, subtree: true })
    schedule(document.body, true)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('languagechange', toggle) }
  }, [])
  return null
}
