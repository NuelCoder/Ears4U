import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as client from './client'
import {
  adminLogin, adminLogout, registerAdmin, verifyAdmin, resendAdminRegistrationOtp,
  forgotAdminPassword, resendAdminForgottenPasswordOtp, resetAdminPassword,
  adminRecoveryInitiate, adminRecoveryConfirm, resendAdminRecoveryOtp,
} from './endpoints'
import { getAdminAccessToken, clearAdminAccessToken } from './token'

describe('admin auth endpoints', () => {
  beforeEach(() => {
    clearAdminAccessToken()
    vi.restoreAllMocks()
  })

  it('adminLogin posts username (not adminEmail) and stores the access token', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ accessToken: 'tok' })
    await adminLogin('a@b.com', 'pw')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/auth/admin-login', {
      method: 'POST', body: { username: 'a@b.com', password: 'pw' }, auth: false,
    })
    expect(getAdminAccessToken()).toBe('tok')
  })

  it('adminLogout clears the token even if the request fails', async () => {
    vi.spyOn(client, 'adminApiFetch').mockRejectedValue(new Error('network'))
    await adminLogout()
    expect(getAdminAccessToken()).toBeNull()
  })

  it('registerAdmin posts adminName, adminEmail, adminPassword with no auth', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await registerAdmin({ adminName: 'Dami', adminEmail: 'a@b.com', adminPassword: 'Aa1!aaaa' })
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/register-admin', {
      method: 'POST', body: { adminName: 'Dami', adminEmail: 'a@b.com', adminPassword: 'Aa1!aaaa' }, auth: false,
    })
  })

  it('verifyAdmin posts the otp and stores the returned token', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ accessToken: 'tok2' })
    await verifyAdmin('a@b.com', '123456')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/verify-admin', {
      method: 'POST', body: { email: 'a@b.com', otp: '123456' }, auth: false,
    })
    expect(getAdminAccessToken()).toBe('tok2')
  })

  it('resendAdminRegistrationOtp sends adminEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resendAdminRegistrationOtp('a@b.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resend-registration-otp?adminEmail=a%40b.com', {
      method: 'POST', auth: false,
    })
  })

  it('forgotAdminPassword sends adminEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await forgotAdminPassword('a@b.com')
    const [path, opts] = (client.adminApiFetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(path).toBe('/api/v1/auth/forgot-admin-password?adminEmail=a%40b.com')
    expect(opts).toEqual({ method: 'POST', auth: false })
  })

  it('resendAdminForgottenPasswordOtp sends adminEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resendAdminForgottenPasswordOtp('a@b.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/auth/resend-admin-forgotten-password-otp?adminEmail=a%40b.com',
      { method: 'POST', auth: false },
    )
  })

  it('resetAdminPassword posts email (not adminEmail), otp, and newPassword', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resetAdminPassword('a@b.com', '123456', 'NewPass1!')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/auth/reset-admin-password', {
      method: 'POST', body: { email: 'a@b.com', otp: '123456', newPassword: 'NewPass1!' }, auth: false,
    })
  })

  it('adminRecoveryInitiate sends adminEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await adminRecoveryInitiate('a@b.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/auth/recovery/admin/initiate?adminEmail=a%40b.com',
      { method: 'POST', auth: false },
    )
  })

  it('adminRecoveryConfirm sends adminEmail and otp as query params, no body, stores the returned token', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ accessToken: 'tok3' })
    await adminRecoveryConfirm('a@b.com', '654321')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/auth/recovery/admin/confirm?adminEmail=a%40b.com&otp=654321',
      { method: 'POST', auth: false },
    )
    expect(getAdminAccessToken()).toBe('tok3')
  })

  it('resendAdminRecoveryOtp sends adminEmail as a query param, no body, and does not force auth: false ' +
    '(the real backend requires an ADMIN JWT for this endpoint despite it living under the recovery flow)', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resendAdminRecoveryOtp('a@b.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resend-recovery-otp?adminEmail=a%40b.com', {
      method: 'POST',
    })
  })
})

import {
  changeAdminPasswordInitiate, changeAdminPasswordVerify, resendAdminPasswordChangeOtp,
  changeAdminEmailInitiate, changeAdminEmailVerify, resendAdminEmailChangeOtp,
} from './endpoints'

describe('admin account credential changes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('changeAdminPasswordInitiate posts email and oldPassword', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await changeAdminPasswordInitiate('a@b.com', 'oldpw')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/change-admin-password/initiate', {
      method: 'POST', body: { email: 'a@b.com', oldPassword: 'oldpw' },
    })
  })

  it('changeAdminPasswordVerify posts email, oldPassword, newPassword, and otp', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await changeAdminPasswordVerify('a@b.com', 'oldpw', 'newpw', '123456')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/change-admin-password/verify', {
      method: 'POST', body: { email: 'a@b.com', oldPassword: 'oldpw', newPassword: 'newpw', otp: '123456' },
    })
  })

  it('resendAdminPasswordChangeOtp posts with no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resendAdminPasswordChangeOtp()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resend-password-change-otp', { method: 'POST' })
  })

  it('changeAdminEmailInitiate posts oldAdminEmail and newAdminEmail', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await changeAdminEmailInitiate('old@b.com', 'new@b.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/change-admin-email/initiate', {
      method: 'POST', body: { oldAdminEmail: 'old@b.com', newAdminEmail: 'new@b.com' },
    })
  })

  it('changeAdminEmailVerify posts oldAdminEmail, newAdminEmail, and otp', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await changeAdminEmailVerify('old@b.com', 'new@b.com', '654321')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/change-admin-email/verify', {
      method: 'POST', body: { oldAdminEmail: 'old@b.com', newAdminEmail: 'new@b.com', otp: '654321' },
    })
  })

  it('resendAdminEmailChangeOtp posts with no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await resendAdminEmailChangeOtp()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resend-email-change-otp', { method: 'POST' })
  })
})

import {
  getAdminDashboard, getAdminEmergencyDashboard, getAdminBroadcastHistory, sendAdminBroadcast, getAdminAnalytics, downloadAdminDashboardExport,
  createAdminEmergencyResource, updateAdminEmergencyResource, deleteAdminEmergencyResource,
} from './endpoints'

describe('admin dashboard and analytics endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getAdminDashboard fetches the dashboard metrics path', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ totalUsers: 1 })
    await getAdminDashboard()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/dashboard')
  })

  it('getAdminEmergencyDashboard fetches the emergency dashboard path', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ totalHotlines: 1, totalWebsites: 2, totalClinics: 0, activeCountriesCount: 1, resources: [] })
    await getAdminEmergencyDashboard()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/emergency/dashboard')
  })

  it('createAdminEmergencyResource posts to the resources path with the input body', async () => {
    const input = { name: 'New Hotline', country: 'USA', resourceType: 'HOTLINE' as const, contactInfo: '1-800-HELP', active: true }
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ id: 7, ...input })
    await createAdminEmergencyResource(input)
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resources', { method: 'POST', body: input })
  })

  it('updateAdminEmergencyResource puts to the resources path with id and input body', async () => {
    const input = { name: 'Updated Hotline', country: 'USA', resourceType: 'HOTLINE' as const, contactInfo: '1-800-UPDATED', active: false }
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ id: 5, ...input })
    await updateAdminEmergencyResource(5, input)
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resources/5', { method: 'PUT', body: input })
  })

  it('deleteAdminEmergencyResource deletes the resource with the given id', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'deleted' })
    await deleteAdminEmergencyResource(3)
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/resources/3', { method: 'DELETE' })
  })

  it('getAdminBroadcastHistory fetches the notifications path and returns the full wrapped ' +
    'NotificationDashboardResponse, including its summary counts', async () => {
    const response = {
      totalSent: 2, toAllUsers: 1, reEngagement: 1,
      notifications: [{ formattedId: 'NTF-0001', title: 'Hi', message: 'msg', segment: 'ALL_USERS', sentAt: '2026-08-05T14:00:00Z' }],
    }
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue(response)
    const result = await getAdminBroadcastHistory()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/dashboard/notifications')
    expect(result).toEqual(response)
  })

  it('sendAdminBroadcast posts title, message, and segment to the broadcast path', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'Broadcast event successfully queued for delivery.' })
    const payload = { title: 'Heads up', message: 'We are rolling out a fix.', segment: 'ALL_USERS' as const }
    await sendAdminBroadcast(payload)
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/broadcast', { method: 'POST', body: payload })
  })

  it('getAdminAnalytics fetches the anaytics path exactly as documented, missing the l, and maps ' +
    'count/mood/requests onto the { date, value } chart shape', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({
      userGrowth: [{ date: '2026-08-01', count: 10 }],
      dailyActiveUsers: [],
      moodStatistics: [{ mood: 'Happy', count: 5 }],
      journalStatistics: [],
      aiUsageStatistics: [{ date: '2026-08-01', requests: 20, successful: 18 }],
    })
    const result = await getAdminAnalytics()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/anaytics')
    expect(result).toEqual({
      userGrowth: [{ date: '2026-08-01', value: 10 }],
      moods: [{ date: 'Happy', value: 5 }],
      aiUsage: [{ date: '2026-08-01', value: 20 }],
    })
  })

  it('downloadAdminDashboardExport fetches the exports path via the blob client', async () => {
    const fakeBlob = new Blob(['a,b'], { type: 'text/csv' })
    vi.spyOn(client, 'adminApiFetchBlob').mockResolvedValue(fakeBlob)
    const result = await downloadAdminDashboardExport()
    expect(client.adminApiFetchBlob).toHaveBeenCalledWith('/api/v1/admins/dashboard/exports')
    expect(result).toBe(fakeBlob)
  })
})

import { getAdminUsers, getAdminAuditLogs, getAdminSettings, getAdminTelemetry } from './endpoints'

describe('admin users read endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('getAdminUsers builds a query string from the provided filters, converting the 1-indexed ' +
    'page to the backend\'s 0-indexed page param', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({
      totalUsers: 0, activeUsers: 0, suspendedUsers: 0, users: [], currentPage: 1, totalPages: 1, totalItems: 0,
    })
    await getAdminUsers({ search: 'ada', status: 'ACTIVE', page: 2 })
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/users?search=ada&status=ACTIVE&page=1&size=5')
  })

  it('getAdminUsers defaults to page 0 and the mock page size when no filters are given', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({
      totalUsers: 0, activeUsers: 0, suspendedUsers: 0, users: [], currentPage: 0, totalPages: 1, totalItems: 0,
    })
    await getAdminUsers()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/users?page=0&size=5')
  })

  it('getAdminAuditLogs fetches the audit-logs path with no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue([])
    await getAdminAuditLogs()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/audit-logs')
  })

  it('getAdminSettings fetches the settings path with no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({
      apiConfiguration: { baseUrl: 'https://api.example.com', apiVersion: 'v1', rateLimitPerMinute: 60, timeoutMs: 30000 },
      emailConfiguration: { apiKey: 'sk-x' + '*'.repeat(16) + '3f2a', senderEmail: 'noreply@example.com', senderName: 'Ears for You' },
      otpConfiguration: { otpLength: 6, otpExpiryMinutes: 10, maxAttempts: 3, deliveryChannel: 'EMAIL' as const },
      securitySettings: { jwtExpiryMinutes: 60, refreshTokenExpiryDays: 7, maxLoginAttempts: 5, sessionTimeoutMinutes: 30, mfaEnabled: false, ipWhitelistEnabled: false },
      aiConfiguration: { enableAiChat: true, aiSystemPrompt: 'You are a mental health support assistant.' },
    })
    await getAdminSettings()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/settings')
  })

  it('getAdminTelemetry fetches the telemetry path with no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({
      totalRequests: 1000,
      successfulRequests: 950,
      failedRequests: 50,
      averageLatencyMs: 125,
      providerStatus: 'OPERATIONAL' as const,
      requestTimeline: [],
    })
    await getAdminTelemetry()
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/telemetry')
  })
})

import { suspendAdminUser, reactivateAdminUser, changeAdminUserEmail, generateAdminUserOtp } from './endpoints'

describe('admin user action endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('suspendAdminUser sends userEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await suspendAdminUser('grace.okafor@example.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/admins/users/suspend?userEmail=grace.okafor%40example.com',
      { method: 'PUT' },
    )
  })

  it('reactivateAdminUser sends userEmail as a query param, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await reactivateAdminUser('amara.chukwu@example.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/admins/users/reactivate?userEmail=amara.chukwu%40example.com',
      { method: 'PUT' },
    )
  })

  it('changeAdminUserEmail sends currentEmail and newEmail as query params, no body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    await changeAdminUserEmail('old@example.com', 'new@example.com')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/admins/users/change-email?currentEmail=old%40example.com&newEmail=new%40example.com',
      { method: 'PUT' },
    )
  })

  it('generateAdminUserOtp dispatches to the correct failover path per kind, with userEmail as a query param', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ otp: '482913' })
    await generateAdminUserOtp('grace.okafor@example.com', 'registration')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/admins/users/failover/registration-otp?userEmail=grace.okafor%40example.com',
      { method: 'POST' },
    )

    await generateAdminUserOtp('grace.okafor@example.com', 'password-change')
    expect(client.adminApiFetch).toHaveBeenCalledWith(
      '/api/v1/admins/users/failover/password-change-otp?userEmail=grace.okafor%40example.com',
      { method: 'POST' },
    )
  })
})

import { updateAdminSettings, resetAdminSetting } from './endpoints'

describe('admin settings write endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('updateAdminSettings sends PATCH with the full settings object as body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: 'ok' })
    const settings = {
      apiConfiguration: { baseUrl: 'https://api.example.com', apiVersion: 'v1', rateLimitPerMinute: 60, timeoutMs: 30000 },
      emailConfiguration: { apiKey: 'sk-x' + '*'.repeat(16) + '3f2a', senderEmail: 'noreply@example.com', senderName: 'Ears for You' },
      otpConfiguration: { otpLength: 6, otpExpiryMinutes: 10, maxAttempts: 3, deliveryChannel: 'EMAIL' as const },
      securitySettings: { jwtExpiryMinutes: 60, refreshTokenExpiryDays: 7, maxLoginAttempts: 5, sessionTimeoutMinutes: 30, mfaEnabled: false, ipWhitelistEnabled: false },
      aiConfiguration: { 
  enableAiChat: true, 
  aiSystemPromptGenZ: 'You are a warm Nigerian friend in your mid-20s.',
  aiSystemPromptMillennial: 'You are a grounded, emotionally intelligent peer.',
  aiSystemPromptGenX: 'You are a calm, respectful, and dignified companion.',
  aiSystemPromptDefault: 'You are a warm, empathetic support assistant.'
}
    }
    await updateAdminSettings(settings)
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/settings', { method: 'PATCH', body: settings })
  })

  it('resetAdminSetting sends DELETE with the key in the URL path, not a query string or body', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: "Setting 'api_base_url' has been reset to system default." })
    await resetAdminSetting('api_base_url')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/settings/api_base_url', { method: 'DELETE' })
  })

  it('resetAdminSetting works for a second, different key (guards against a hardcoded single-key assumption)', async () => {
    vi.spyOn(client, 'adminApiFetch').mockResolvedValue({ message: "Setting 'security_mfa_enabled' has been reset to system default." })
    await resetAdminSetting('security_mfa_enabled')
    expect(client.adminApiFetch).toHaveBeenCalledWith('/api/v1/admins/settings/security_mfa_enabled', { method: 'DELETE' })
  })
})
