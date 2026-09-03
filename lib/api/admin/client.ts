import { getAdminAccessToken, setAdminAccessToken, clearAdminAccessToken } from './token'
import { ApiError, friendlyFor, COLD_START_MESSAGE, NETWORK_ERROR_MESSAGE } from '../errors'
import { MOCKS_ENABLED } from '../../mocks'
import { adminMockFetch } from './mock-fetch'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''
const DEFAULT_COLD_START_MS = 8000

let authExpiredCb: (() => void) | null = null
export function onAdminAuthExpired(cb: () => void): void {
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

let inFlightRefresh: Promise<boolean> | null = null

export async function refreshAdminSession(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = (async () => {
    let res: Response
    try {
      res = await fetch(`${BASE}/api/v1/auth/admin-refresh`, { method: 'POST', credentials: 'include' })
    } catch {
      throw new ApiError(0, NETWORK_ERROR_MESSAGE)
    }
    if (!res.ok) return false
    const body = (await parseBody(res)) as { accessToken?: string } | undefined
    if (!body?.accessToken) return false
    setAdminAccessToken(body.accessToken)
    return true
  })()

  try {
    return await inFlightRefresh
  } finally {
    inFlightRefresh = null
  }
}

export async function adminApiFetch<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  if (MOCKS_ENABLED) {
    return adminMockFetch<T>(path, opts)
  }

  const { method = 'GET', body, auth = true, coldStartMs = DEFAULT_COLD_START_MS } = opts

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers()
    if (body !== undefined) headers.set('content-type', 'application/json')
    const token = getAdminAccessToken()
    if (auth && token) headers.set('authorization', `Bearer ${token}`)
    try {
      return await fetch(`${BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, NETWORK_ERROR_MESSAGE)
    }
  }

  const started = Date.now()
  let res = await doFetch()

  if (auth && (res.status === 401 || res.status === 403)) {
    const ok = await refreshAdminSession()
    if (ok) {
      res = await doFetch()
      if (res.status === 401 || res.status === 403) {
        clearAdminAccessToken()
        authExpiredCb?.()
      }
    } else {
      clearAdminAccessToken()
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

export async function adminApiFetchBlob(path: string, coldStartMs: number = DEFAULT_COLD_START_MS): Promise<Blob> {
  if (MOCKS_ENABLED) {
    return adminMockFetch<Blob>(path, { method: 'GET' })
  }

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers()
    const token = getAdminAccessToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    try {
      return await fetch(`${BASE}${path}`, { method: 'GET', headers, credentials: 'include' })
    } catch {
      throw new ApiError(0, NETWORK_ERROR_MESSAGE)
    }
  }

  const started = Date.now()
  let res = await doFetch()

  if (res.status === 401 || res.status === 403) {
    const ok = await refreshAdminSession()
    if (ok) {
      res = await doFetch()
      if (res.status === 401 || res.status === 403) {
        clearAdminAccessToken()
        authExpiredCb?.()
      }
    } else {
      clearAdminAccessToken()
      authExpiredCb?.()
      throw new ApiError(res.status, friendlyFor(401))
    }
  }

  if (!res.ok) {
    const elapsed = Date.now() - started
    const coldStart = elapsed >= coldStartMs && [500, 502, 503, 504].includes(res.status)
    throw new ApiError(res.status, coldStart ? COLD_START_MESSAGE : friendlyFor(res.status), coldStart)
  }

  return res.blob()
}
