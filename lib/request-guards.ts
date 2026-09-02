const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export class RequestBodyError extends Error {
  status: 400 | 413
  code: 'INVALID_JSON' | 'REQUEST_TOO_LARGE'

  constructor(message: string, status: 400 | 413, code: 'INVALID_JSON' | 'REQUEST_TOO_LARGE') {
    super(message)
    this.name = 'RequestBodyError'
    this.status = status
    this.code = code
  }
}

function errorResponse(message: string, status: 400 | 403 | 413 | 415, code: string) {
  return Response.json({ error: message, code }, {
    status,
    headers: SECURITY_HEADERS,
  })
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function requestClientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('x-real-ip')?.trim() || forwarded || 'unknown'
}

export function rateLimit(request: Request, options: { bucket: string; limit: number; windowMs: number }) {
  const now = Date.now()
  if (rateBuckets.size > 5_000) {
    for (const [key, value] of rateBuckets) {
      if (value.resetAt <= now) rateBuckets.delete(key)
    }
  }

  const key = `${options.bucket}:${requestClientKey(request)}`
  const current = rateBuckets.get(key)
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current
  bucket.count += 1
  rateBuckets.set(key, bucket)
  if (bucket.count <= options.limit) return null

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return Response.json({ error: 'تم تجاوز عدد الطلبات المسموح مؤقتًا', code: 'RATE_LIMITED' }, {
    status: 429,
    headers: { ...SECURITY_HEADERS, 'Retry-After': String(retryAfter) },
  })
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return false
    } catch {
      return false
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
}

export function guardRequest(request: Request, options: { maxBytes: number; requireJson?: boolean }) {
  if (!sameOrigin(request)) return errorResponse('لا يسمح بهذا الطلب من مصدر خارجي', 403, 'CROSS_ORIGIN_REQUEST')

  const length = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(length) && length > options.maxBytes) {
    return errorResponse('حجم الطلب أكبر من الحد المسموح', 413, 'REQUEST_TOO_LARGE')
  }

  if (options.requireJson && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return errorResponse('يجب إرسال الطلب بصيغة JSON', 415, 'UNSUPPORTED_CONTENT_TYPE')
  }

  return null
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > maxBytes) {
    throw new RequestBodyError('حجم الطلب أكبر من الحد المسموح', 413, 'REQUEST_TOO_LARGE')
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    throw new RequestBodyError('صيغة JSON غير صالحة', 400, 'INVALID_JSON')
  }
}

export const securityHeaders = SECURITY_HEADERS
