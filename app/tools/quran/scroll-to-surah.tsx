"use client"

import { useEffect } from "react"

export function ScrollToSurah({ surahNumber }: { surahNumber: number }) {
  useEffect(() => {
    const el = document.getElementById(`surah-${surahNumber}`)
    if (el) {
      // نستخدم تمريرًا فوريًا حتى تبدأ القراءة مباشرة من السورة المختارة دون وميض تمرير مرئي.
      el.scrollIntoView({ behavior: "auto", block: "start" })
    }
  }, [surahNumber])
  return null
}
