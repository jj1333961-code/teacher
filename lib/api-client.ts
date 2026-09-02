export class ApiRequestError extends Error {
  status: number
  retryable: boolean

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.retryable = status === 408 || status === 429 || status >= 500 || status === 0
  }
}

type RequestOptions = RequestInit & { retries?: number; timeoutMs?: number }

function abortError() {
  return new DOMException('تم إلغاء الطلب', 'AbortError')
}

function waitForRetry(delayMs: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, delayMs)
    const cancel = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      reject(abortError())
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

export async function requestJson<T>(input: RequestInfo | URL, options: RequestOptions = {}): Promise<T> {
  const { retries = 0, timeoutMs = 10000, signal: callerSignal, ...init } = options
  let attempt = 0
  while (true) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
    const forwardAbort = () => controller.abort()
    if (callerSignal?.aborted) controller.abort()
    else callerSignal?.addEventListener('abort', forwardAbort, { once: true })
    try {
      const response = await fetch(input, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...(init.headers ?? {}) } })
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new ApiRequestError(payload.error || payload.message || 'تعذر تنفيذ الطلب', response.status)
      return payload as T
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (!(error instanceof ApiRequestError) || !error.retryable || attempt >= retries) throw error
      attempt += 1
      await waitForRetry(250 * attempt, callerSignal)
    } finally {
      clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', forwardAbort)
    }
  }
}
