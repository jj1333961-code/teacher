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
