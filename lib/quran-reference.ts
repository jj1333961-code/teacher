import { get } from "@vercel/blob"

const PATHS = { mushaf: "references/quran.pdf", mutashabihat: "references/mutashabihat", mushafMeta: "references/meta/mushaf.json", mutashabihatMeta: "references/meta/mutashabihat.json" }
const MAX_REFERENCE_CHARS = 240_000
type ReferenceCache = { quran: string; mutashabihat: string; loadedAt: number }
let cache: ReferenceCache | null = null
let pending: Promise<ReferenceCache> | null = null

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

async function readPrivateBlob(pathname: string) {
  const result = await get(pathname, { access: "private" })
  if (!result || result.statusCode !== 200) throw new Error("المرجع المطلوب غير مرفوع بعد")
  return new Uint8Array(await new Response(result.stream).arrayBuffer())
}

async function readReferenceText(metadataPathname: string) {
  const data = await readPrivateBlob(metadataPathname)
  const parsed = JSON.parse(new TextDecoder().decode(data)) as { text?: string }
  const text = String(parsed.text || "").trim().slice(0, MAX_REFERENCE_CHARS)
  if (!text) throw new Error("تعذر قراءة نص المرجع")
  return text
}

export async function loadQuranReferences() {
  if (cache && Date.now() - cache.loadedAt < 5 * 60 * 1000) return cache
  if (!pending) pending = Promise.all([readReferenceText(PATHS.mushafMeta), readReferenceText(PATHS.mutashabihatMeta)])
    .then(([quran, mutashabihat]) => (cache = { quran, mutashabihat, loadedAt: Date.now() }))
    .finally(() => { pending = null })
  return pending
}

function relevantWindows(source: string, terms: string[], windowSize = 900, limit = 5) {
  const normalizedSource = normalize(source)
  const windows: string[] = []
  for (const term of terms.map(normalize).filter((value) => value.length > 2)) {
    const index = normalizedSource.indexOf(term)
    if (index < 0) continue
    const sourceIndex = Math.floor((index / Math.max(1, normalizedSource.length)) * source.length)
    windows.push(source.slice(Math.max(0, sourceIndex - windowSize), sourceIndex + windowSize))
    if (windows.length >= limit) break
  }
  return windows
}

export async function getReferenceContext(query: string, extraTerms: string[] = []) {
  const references = await loadQuranReferences()
  const terms = [query, ...extraTerms]
  const quranMatches = relevantWindows(references.quran, terms, 1100, 4)
  const mutashabihatMatches = relevantWindows(references.mutashabihat, terms, 1100, 4)
  return [quranMatches.length ? `مقتطفات المصحف المرفق:\n${quranMatches.join("\n---\n")}` : "", mutashabihatMatches.length ? `مقتطفات ملف المتشابهات المرفق:\n${mutashabihatMatches.join("\n---\n")}` : ""].filter(Boolean).join("\n\n").slice(0, 14_000)
}

export async function getQuranPdfBytes() { return readPrivateBlob(PATHS.mushaf) }
export function normalizeQuranText(value: string) { return normalize(value) }
