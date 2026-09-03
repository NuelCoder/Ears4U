import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { adminApiFetch, adminApiFetchBlob, onAdminAuthExpired, refreshAdminSession } from './client'
import { getAdminAccessToken, setAdminAccessToken, clearAdminAccessToken } from './token'
import { ApiError, COLD_START_MESSAGE } from '../errors'

const originalFetch = global.fetch

describe('Hybrid Routing Strategy', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://earsforyou.onrender.com')
    clearAdminAccessToken()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
  })

  it('routes auth requests through the Vercel proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    global.fetch = fetchMock as unknown as typeof fetch

    await adminApiFetch('/api/v1/auth/admin-login', { auth: false })
    
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/backend/api/v1/auth/admin-login')
  })

  it('routes data requests directly to the Render backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    global.fetch = fetchMock as unknown as typeof fetch

    await adminApiFetch('/api/v1/admins/me', { auth: false })
    
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://earsforyou.onrender.com/api/v1/admins/me')
  })
})

describe('adminApiFetch', () => {
  beforeEach(() => {
    clearAdminAccessToken()
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends a bearer token when authenticated', async () => {
    setAdminAccessToken('tok-123')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    await adminApiFetch('/api/v1/admins/me')

    const [, init] = fetchMock.mock.calls[0]!
    const headers = init.headers as Headers
    expect(headers.get('authorization')).toBe('Bearer tok-123')
  })

  it('refreshes once on 401 and retries, then succeeds', async () => {
    setAdminAccessToken('stale')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'fresh' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await adminApiFetch<{ ok: boolean }>('/api/v1/admins/me')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]![0]).toBe('/backend/api/v1/auth/admin-refresh')
    const refreshInit = fetchMock.mock.calls[1]![1]
    expect(refreshInit.credentials).toBe('include')
    expect(getAdminAccessToken()).toBe('fresh')
  })

  it('clears the token and fires onAdminAuthExpired when refresh fails', async () => {
    setAdminAccessToken('stale')
    const expired = vi.fn()
    onAdminAuthExpired(expired)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(adminApiFetch('/api/v1/admins/me')).rejects.toThrow()

    expect(expired).toHaveBeenCalledTimes(1)
    expect(getAdminAccessToken()).toBeNull()
  })
})

describe('refreshAdminSession', () => {
  beforeEach(() => {
    clearAdminAccessToken()
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('shares one in-flight request across concurrent callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'shared-token' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const [first, second] = await Promise.all([refreshAdminSession(), refreshAdminSession()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(getAdminAccessToken()).toBe('shared-token')
  })

  it('allows a new refresh once the in-flight one has settled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    await refreshAdminSession()
    await refreshAdminSession()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('adminApiFetchBlob', () => {
  beforeEach(() => {
    clearAdminAccessToken()
  })
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns a blob on success, with a bearer token when authenticated', async () => {
    setAdminAccessToken('tok-blob')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(['a,b\n1,2'], { type: 'text/csv' }), { status: 200 })
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const blob = await adminApiFetchBlob('/api/v1/admins/dashboard/exports')

    expect(blob).toBeInstanceOf(Blob)
    const [, init] = fetchMock.mock.calls[0]!
    const headers = init.headers as Headers
    expect(headers.get('authorization')).toBe('Bearer tok-blob')
    expect(init.credentials).toBe('include')
  })

  it('refreshes once on 401 and retries, then returns a blob', async () => {
    setAdminAccessToken('stale')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'fresh' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(new Blob(['x'], { type: 'text/csv' }), { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    const blob = await adminApiFetchBlob('/api/v1/admins/dashboard/exports')

    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]![0]).toBe('/backend/api/v1/auth/admin-refresh')
  })

  it('throws an ApiError when the request fails and refresh also fails', async () => {
    setAdminAccessToken('stale')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(adminApiFetchBlob('/api/v1/admins/dashboard/exports')).rejects.toThrow()
    expect(getAdminAccessToken()).toBeNull()
  })

  it('marks a slow 5xx response as a cold start', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(new Response(null, { status: 503 })), 30))
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const err = (await adminApiFetchBlob('/api/v1/admins/dashboard/exports', 10).catch(e => e)) as ApiError

    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toBe(COLD_START_MESSAGE)
    expect(err.coldStart).toBe(true)
  })
})