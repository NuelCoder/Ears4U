import { describe, it, expect } from 'vitest'
import { adminMockFetch } from './mock-fetch'
import type { AdminSystemSettings } from './types'

describe('adminMockFetch', () => {
  it('returns an access token for admin login', async () => {
    const r = await adminMockFetch<{ accessToken: string }>('/api/v1/auth/admin-login', {
      method: 'POST', body: { username: 'admin@earsforyou.test', password: 'whatever' },
    })
    expect(r.accessToken).toBe('mock-admin-access-token')
  })

  it('resolves logout with no body', async () => {
    const r = await adminMockFetch('/api/v1/auth/logout', { method: 'POST' })
    expect(r).toBeUndefined()
  })

  it('returns a message for admin registration', async () => {
    const r = await adminMockFetch<{ message: string }>('/api/v1/admins/register-admin', {
      method: 'POST',
      body: { adminName: 'Ada Admin', adminEmail: 'ada@earsforyou.test', adminPassword: 'Password1!' },
    })
    expect(r.message).toBe('Registration started')
  })

  it('returns an access token for admin verification', async () => {
    const r = await adminMockFetch<{ accessToken: string }>('/api/v1/admins/verify-admin', {
      method: 'POST', body: { email: 'ada@earsforyou.test', otp: '123456' },
    })
    expect(r.accessToken).toBe('mock-admin-access-token')
  })

  it.each([
    '/api/v1/admins/resend-registration-otp?adminEmail=ada%40earsforyou.test',
    '/api/v1/admins/resend-recovery-otp?adminEmail=ada%40earsforyou.test',
    '/api/v1/auth/forgot-admin-password?adminEmail=ada%40earsforyou.test',
    '/api/v1/auth/resend-admin-forgotten-password-otp?adminEmail=ada%40earsforyou.test',
    '/api/v1/auth/reset-admin-password',
    '/api/v1/auth/recovery/admin/initiate?adminEmail=ada%40earsforyou.test',
  ])('returns an ok message for POST %s', async path => {
    const r = await adminMockFetch<{ message: string }>(path, { method: 'POST', body: {} })
    expect(r.message).toBe('ok')
  })

  it('returns an access token for recovery confirm', async () => {
    const r = await adminMockFetch<{ accessToken: string }>(
      '/api/v1/auth/recovery/admin/confirm?adminEmail=ada%40earsforyou.test&otp=123456',
      { method: 'POST' },
    )
    expect(r.accessToken).toBe('mock-admin-access-token')
  })

  it('returns the stored profile for GET me', async () => {
    const r = await adminMockFetch<{ adminName: string; adminEmail: string; role: string; createdAt: string | null }>(
      '/api/v1/admins/me',
    )
    expect(r.adminName).toBeTruthy()
    expect(r.adminEmail).toBeTruthy()
    expect(r.role).toBe('Admin')
    expect(r.createdAt).toBeNull()
  })

  it('updates and persists the profile on PUT me', async () => {
    const updated = await adminMockFetch<{ adminName: string }>('/api/v1/admins/me', {
      method: 'PUT', body: { adminName: 'Updated Name' },
    })
    expect(updated.adminName).toBe('Updated Name')

    const after = await adminMockFetch<{ adminName: string }>('/api/v1/admins/me')
    expect(after.adminName).toBe('Updated Name')
  })

  it('resolves DELETE me with no body', async () => {
    const r = await adminMockFetch('/api/v1/admins/me', { method: 'DELETE' })
    expect(r).toBeUndefined()
  })

  it.each([
    '/api/v1/admins/change-admin-password/initiate',
    '/api/v1/admins/change-admin-password/verify',
    '/api/v1/admins/resend-password-change-otp',
    '/api/v1/admins/change-admin-email/initiate',
    '/api/v1/admins/resend-email-change-otp',
  ])('returns an ok message for POST %s', async path => {
    const r = await adminMockFetch<{ message: string }>(path, { method: 'POST', body: {} })
    expect(r.message).toBe('ok')
  })

  it('confirms an email change and persists the new email', async () => {
    const updated = await adminMockFetch<{ adminEmail: string }>('/api/v1/admins/change-admin-email/verify', {
      method: 'POST',
      body: { oldAdminEmail: 'admin@earsforyou.test', newAdminEmail: 'new@earsforyou.test', otp: '123456' },
    })
    expect(updated.adminEmail).toBe('new@earsforyou.test')

    const after = await adminMockFetch<{ adminEmail: string }>('/api/v1/admins/me')
    expect(after.adminEmail).toBe('new@earsforyou.test')
  })

  it('throws for an unmapped path so gaps are loud, not silent', async () => {
    await expect(adminMockFetch('/api/v1/does-not-exist')).rejects.toThrow(/no mock route/)
  })

  describe('emergency resources', () => {
    it('creates and returns a resource with a generated id on POST /api/v1/admins/resources', async () => {
      const r = await adminMockFetch<{ id: number; name: string }>('/api/v1/admins/resources', {
        method: 'POST',
        body: { name: 'Youth Support Line', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: true },
      })
      expect(r.name).toBe('Youth Support Line')
      expect(typeof r.id).toBe('number')
    })

    it('updates and returns the resource on PUT /api/v1/admins/resources/{id} for a real id', async () => {
      const created = await adminMockFetch<{ id: number }>('/api/v1/admins/resources', {
        method: 'POST',
        body: { name: 'Old Name', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: true },
      })
      const updated = await adminMockFetch<{ id: number; name: string }>(`/api/v1/admins/resources/${created.id}`, {
        method: 'PUT',
        body: { name: 'New Name', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: false },
      })
      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('New Name')
    })

    it('throws when PUT /api/v1/admins/resources/{id} targets a nonexistent id', async () => {
      await expect(
        adminMockFetch('/api/v1/admins/resources/999999', {
          method: 'PUT',
          body: { name: 'Ghost', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: true },
        }),
      ).rejects.toThrow()
    })

    it('removes the resource on DELETE /api/v1/admins/resources/{id}', async () => {
      const created = await adminMockFetch<{ id: number }>('/api/v1/admins/resources', {
        method: 'POST',
        body: { name: 'To Delete', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: true },
      })
      const deleteResult = await adminMockFetch(`/api/v1/admins/resources/${created.id}`, { method: 'DELETE' })
      expect(deleteResult).toEqual({ message: 'Emergency resource deleted successfully.' })

      // Deleting again (or updating) the now-gone id should throw, confirming it's actually gone.
      await expect(
        adminMockFetch(`/api/v1/admins/resources/${created.id}`, {
          method: 'PUT',
          body: { name: 'Ghost', country: 'Kenya', resourceType: 'HOTLINE', contactInfo: '0800-000-000', active: true },
        }),
      ).rejects.toThrow()
    })

    it('does not match the id-route regex for the id-less collection path, falling through to the unmapped-path error for PUT/DELETE', async () => {
      await expect(adminMockFetch('/api/v1/admins/resources', { method: 'PUT', body: {} })).rejects.toThrow(/no mock route/)
      await expect(adminMockFetch('/api/v1/admins/resources', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })

    it('does not match the id-route regex for a non-numeric id segment', async () => {
      await expect(adminMockFetch('/api/v1/admins/resources/abc', { method: 'PUT', body: {} })).rejects.toThrow(/no mock route/)
      await expect(adminMockFetch('/api/v1/admins/resources/abc', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })

    it('does not match the id-route regex when there is an extra trailing path segment', async () => {
      await expect(adminMockFetch('/api/v1/admins/resources/1/extra-segment', { method: 'PUT', body: {} })).rejects.toThrow(/no mock route/)
      await expect(adminMockFetch('/api/v1/admins/resources/1/extra-segment', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })
  })

  describe('settings', () => {
    it('PATCH /api/v1/admins/settings updates the mock store, reflected on a subsequent GET', async () => {
      const patchBody: AdminSystemSettings = {
        apiConfiguration: { baseUrl: 'https://staging.earsfor.you', apiVersion: 'v2', rateLimitPerMinute: 240, timeoutMs: 8000 },
        emailConfiguration: { apiKey: 'sk-freshkey-abcdef', senderEmail: 'ops@earsfor.you', senderName: 'Ears For You Ops' },
        otpConfiguration: { otpLength: 8, otpExpiryMinutes: 15, maxAttempts: 5, deliveryChannel: 'BOTH' },
        securitySettings: { jwtExpiryMinutes: 45, refreshTokenExpiryDays: 14, maxLoginAttempts: 8, sessionTimeoutMinutes: 20, mfaEnabled: false, ipWhitelistEnabled: true },
        aiConfiguration: { 
  enableAiChat: false, 
  aiSystemPromptGenZ: 'Custom staging prompt.',
  aiSystemPromptMillennial: 'Custom staging prompt.',
  aiSystemPromptGenX: 'Custom staging prompt.',
  aiSystemPromptDefault: 'Custom staging prompt.'
}
      }
      const patchResult = await adminMockFetch<{ message: string }>('/api/v1/admins/settings', { method: 'PATCH', body: patchBody })
      expect(patchResult.message).toBe('System settings updated successfully. Changes are now live.')

      const after = await adminMockFetch<AdminSystemSettings>('/api/v1/admins/settings')
      expect(after.apiConfiguration).toEqual(patchBody.apiConfiguration)
      expect(after.emailConfiguration).toEqual(patchBody.emailConfiguration)
      expect(after.otpConfiguration).toEqual(patchBody.otpConfiguration)
      expect(after.securitySettings).toEqual(patchBody.securitySettings)
      expect(after.aiConfiguration).toEqual(patchBody.aiConfiguration)
    })

    it('masking guard: a PATCH with the masked apiKey (8+ consecutive *) does not overwrite the stored key, but a genuinely new key does', async () => {
      const baseline: AdminSystemSettings = {
        apiConfiguration: { baseUrl: 'https://api.example.com', apiVersion: 'v1', rateLimitPerMinute: 120, timeoutMs: 5000 },
        emailConfiguration: { apiKey: 'sk-realbaselinekey', senderEmail: 'ops@earsfor.you', senderName: 'Ears For You Ops' },
        otpConfiguration: { otpLength: 6, otpExpiryMinutes: 10, maxAttempts: 3, deliveryChannel: 'EMAIL' },
        securitySettings: { jwtExpiryMinutes: 60, refreshTokenExpiryDays: 7, maxLoginAttempts: 5, sessionTimeoutMinutes: 30, mfaEnabled: true, ipWhitelistEnabled: false },
        aiConfiguration: { enableAiChat: true, aiSystemPromptGenZ: 'Baseline prompt.', aiSystemPromptMillennial: 'Baseline prompt.', aiSystemPromptGenX: 'Baseline prompt.', aiSystemPromptDefault: 'Baseline prompt.' },
      }
      await adminMockFetch('/api/v1/admins/settings', { method: 'PATCH', body: baseline })

      // Round-trip the masked value (16 consecutive '*', the exact shape GET renders), the way a
      // naive "resend whatever GET returned" flow would - must be a safe no-op on the real key.
      const maskedRoundTrip: AdminSystemSettings = {
        ...baseline,
        emailConfiguration: { ...baseline.emailConfiguration, apiKey: 'sk-r' + '*'.repeat(16) + 'key' },
      }
      await adminMockFetch('/api/v1/admins/settings', { method: 'PATCH', body: maskedRoundTrip })
      const afterMasked = await adminMockFetch<AdminSystemSettings>('/api/v1/admins/settings')
      expect(afterMasked.emailConfiguration.apiKey).toBe('sk-realbaselinekey')

      // A genuinely new (unmasked) key must overwrite the stored value.
      const withNewKey: AdminSystemSettings = {
        ...baseline,
        emailConfiguration: { ...baseline.emailConfiguration, apiKey: 'sk-brandnewrealkey' },
      }
      await adminMockFetch('/api/v1/admins/settings', { method: 'PATCH', body: withNewKey })
      const afterNew = await adminMockFetch<AdminSystemSettings>('/api/v1/admins/settings')
      expect(afterNew.emailConfiguration.apiKey).toBe('sk-brandnewrealkey')
    })

    it('DELETE /api/v1/admins/settings/{key} resets exactly that field to its documented default, across sections', async () => {
      const custom: AdminSystemSettings = {
        apiConfiguration: { baseUrl: 'https://custom.example.com', apiVersion: 'v9', rateLimitPerMinute: 500, timeoutMs: 12000 },
        emailConfiguration: { apiKey: 'sk-customkey', senderEmail: 'custom@example.com', senderName: 'Custom Sender' },
        otpConfiguration: { otpLength: 10, otpExpiryMinutes: 30, maxAttempts: 9, deliveryChannel: 'SMS' },
        securitySettings: { jwtExpiryMinutes: 999, refreshTokenExpiryDays: 888, maxLoginAttempts: 77, sessionTimeoutMinutes: 66, mfaEnabled: false, ipWhitelistEnabled: true },
        aiConfiguration: { enableAiChat: false, aiSystemPromptGenZ: 'Custom prompt.', aiSystemPromptMillennial: 'Custom prompt.', aiSystemPromptGenX: 'Custom prompt.', aiSystemPromptDefault: 'Custom prompt.' },
      }
      await adminMockFetch('/api/v1/admins/settings', { method: 'PATCH', body: custom })

      const rateLimitReset = await adminMockFetch<{ message: string }>(
        '/api/v1/admins/settings/api_rate_limit_per_minute', { method: 'DELETE' },
      )
      expect(rateLimitReset.message).toBe("Setting 'api_rate_limit_per_minute' has been reset to system default.")
      await adminMockFetch('/api/v1/admins/settings/otp_delivery_channel', { method: 'DELETE' })
      // Adjacent-name-pair check: resetting jwt_expiry_minutes must not affect refreshTokenExpiryDays,
      // which lives in the same section but is reset by the differently-named jwt_refresh_expiry_days key.
      await adminMockFetch('/api/v1/admins/settings/jwt_expiry_minutes', { method: 'DELETE' })

      const after = await adminMockFetch<AdminSystemSettings>('/api/v1/admins/settings')
      expect(after.apiConfiguration.rateLimitPerMinute).toBe(120)
      expect(after.otpConfiguration.deliveryChannel).toBe('EMAIL')
      expect(after.securitySettings.jwtExpiryMinutes).toBe(60)
      // Sibling field, reset only by its own differently-named key, must still hold the custom value.
      expect(after.securitySettings.refreshTokenExpiryDays).toBe(888)
      // Fields not yet reset remain untouched, confirming reset is scoped to exactly the requested key.
      expect(after.apiConfiguration.baseUrl).toBe('https://custom.example.com')
      expect(after.aiConfiguration.aiSystemPromptGenZ).toBe('Custom prompt.')
      expect(after.aiConfiguration.aiSystemPromptMillennial).toBe('Custom prompt.')
      expect(after.aiConfiguration.aiSystemPromptGenX).toBe('Custom prompt.')
      expect(after.aiConfiguration.aiSystemPromptDefault).toBe('Custom prompt.')

      // Now reset the sibling too, and confirm it independently reaches its own (different) default.
      await adminMockFetch('/api/v1/admins/settings/jwt_refresh_expiry_days', { method: 'DELETE' })
      const afterSibling = await adminMockFetch<AdminSystemSettings>('/api/v1/admins/settings')
      expect(afterSibling.securitySettings.refreshTokenExpiryDays).toBe(7)
      expect(afterSibling.securitySettings.jwtExpiryMinutes).toBe(60)
    })

    it('the {key} DELETE regex does not match the id-less settings collection path', async () => {
      await expect(adminMockFetch('/api/v1/admins/settings', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })

    it('throws for a key segment outside the lowercase/underscore character class', async () => {
      await expect(adminMockFetch('/api/v1/admins/settings/API_BASE_URL', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
      await expect(adminMockFetch('/api/v1/admins/settings/api-base-url', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })

    it('throws for an extra trailing path segment after the key', async () => {
      await expect(adminMockFetch('/api/v1/admins/settings/api_base_url/extra', { method: 'DELETE' })).rejects.toThrow(/no mock route/)
    })

    it('a key that matches the path shape but is not a real reset key throws instead of silently no-opping', async () => {
      // Traces the actual fallthrough: the regex matches (lowercase + underscores), routing into
      // adminMockStore.resetSetting, but SETTING_RESET_DEFAULTS has no entry for this key, so
      // calling it as a function throws a TypeError rather than resolving or hitting the generic
      // "no mock route" error - a real bug here would surface loudly, not silently no-op.
      await expect(adminMockFetch('/api/v1/admins/settings/totally_unknown_key', { method: 'DELETE' }))
        .rejects.toThrow(/is not a function/)
    })
  })
})
