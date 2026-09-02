import { getAccessToken, setAccessToken, clearAccessToken } from './token'
import { ApiError, friendlyFor, COLD_START_MESSAGE, NETWORK_ERROR_MESSAGE } from './errors'
import { MOCKS_ENABLED } from '../mocks'
import { mockFetch } from './mock-fetch'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''
const DEFAULT_COLD_START_MS = 8000

let authExpiredCb: (() => void) | null = null
export function onAuthExpired(cb: () => void): void {
  authExpiredCb = cb
}

type Opts = {
  method?: string
  body?: unknown
  auth?: boolean
  coldStartMs?: number
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '')
  if (!text) return undefined
  try { return JSON.parse(text) } catch { return undefined }
}

async function refresh(): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/v1/auth/user-refresh`, { method: 'POST' })
  } catch {
    // A network failure is not an auth failure. Let it propagate as an
    // ApiError so the caller does not clear the token or redirect to sign-in.
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
  if (!res.ok) return false
  const body = (await parseBody(res)) as { accessToken?: string } | undefined
  if (!body?.accessToken) return false
  setAccessToken(body.accessToken)
  return true
}

export async function apiFetch<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  if (MOCKS_ENABLED) {
    return mockFetch<T>(path, opts)
  }

  const { method = 'GET', body, auth = true, coldStartMs = DEFAULT_COLD_START_MS } = opts

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers()
    if (body !== undefined) headers.set('content-type', 'application/json')
    const token = getAccessToken()
    if (auth && token) headers.set('authorization', `Bearer ${token}`)
    try {
      return await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, NETWORK_ERROR_MESSAGE)
    }
  }

  const started = Date.now()
  let res = await doFetch()

  if (auth && (res.status === 401 || res.status === 403)) {
    const ok = await refresh()
    if (ok) {
      res = await doFetch()
      if (res.status === 401 || res.status === 403) {
        clearAccessToken()
        authExpiredCb?.()
      }
    } else {
      clearAccessToken()
      authExpiredCb?.()
      throw new ApiError(res.status, friendlyFor(401))
    }
  }

  const elapsed = Date.now() - started
  const parsed = await parseBody(res)

  if (!res.ok) {
    const msg = (parsed as { message?: string } | undefined)?.message
    const coldStart = elapsed >= coldStartMs && [500, 502, 503, 504].includes(res.status)
    throw new ApiError(res.status, coldStart ? COLD_START_MESSAGE : friendlyFor(res.status, msg), coldStart)
  }

  return parsed as T
}
