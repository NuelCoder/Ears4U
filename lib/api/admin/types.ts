export interface AdminProfile {
  adminName: string
  adminEmail: string
  role: string
  createdAt: string | null
}
export interface AdminRegisterPayload {
  adminName: string
  adminEmail: string
  adminPassword: string
}
export type UpdateAdminProfilePayload = Pick<AdminProfile, 'adminName'>
// Backend DashboardMetricsDTO (GET /api/v1/admins/dashboard). The real DTO also carries
// userGrowth/moodStatistics/aiUsageStatistics/journalStatistics chart series, but those are not
// consumed here since the Analytics page already covers the same data via a separate endpoint
// (getAdminAnalytics) - only the 5 scalar counters are needed on the Dashboard page.
export interface AdminDashboardMetrics {
  totalUsers: number
  activeUsers: number
  journalEntries: number
  moodLogs: number
  aiChats: number
}
// Backend NotificationItem (nested inside NotificationDashboardResponse).
export interface AdminBroadcastHistoryItem {
  formattedId: string
  title: string
  message: string
  segment: string
  sentAt: string
}
// Backend NotificationDashboardResponse (GET /api/v1/admins/dashboard/notifications) - the real
// endpoint returns this wrapper object, not a bare array of notifications.
export interface AdminNotificationDashboardResponse {
  totalSent: number
  toAllUsers: number
  reEngagement: number
  notifications: AdminBroadcastHistoryItem[]
}
// Backend BroadcastRequest (POST /api/v1/admins/broadcast).
export interface AdminBroadcastPayload {
  title: string
  message: string
  segment: 'ALL_USERS' | 'RE_ENGAGEMENT' | 'SYSTEM_MAINTENANCE'
}

// Backend TimeSeriesPoint/MoodPoint/AiUsagePoint (shared shapes used by both DashboardMetricsDTO
// and AdminAnalyticsResponse).
export interface AdminTimeSeriesPoint {
  date: string
  count: number
}
export interface AdminMoodPoint {
  mood: string
  count: number
}
export interface AdminAiUsagePoint {
  date: string
  requests: number
  successful: number
}
// Backend AdminAnalyticsResponse (GET /api/v1/admins/anaytics, misspelling preserved verbatim -
// see getAdminAnalytics). dailyActiveUsers and journalStatistics exist on the real response but
// are out of this phase's 3-chart scope (User growth, Moods, AI usage) - a future phase could
// surface them.
export interface AdminAnalyticsResponse {
  userGrowth: AdminTimeSeriesPoint[]
  dailyActiveUsers: AdminTimeSeriesPoint[]
  moodStatistics: AdminMoodPoint[]
  journalStatistics: AdminTimeSeriesPoint[]
  aiUsageStatistics: AdminAiUsagePoint[]
}

// Internal chart-facing shape - kept as { date, value } so TimeSeriesChart's existing prop
// contract (shared, tested code from Phase 2) doesn't need to change. getAdminAnalytics maps the
// real wire fields (count / mood / requests) onto date/value at the API boundary. For the Moods
// chart, "date" holds the mood category label, not an actual date - safe because timeSeriesPath
// (lib/charts/time-series.ts) only consumes an ordered numeric array and never parses this field
// as a Date; it is used purely as a first/last display label.
export interface AdminAnalyticsPoint {
  date: string
  value: number
}
export interface AdminAnalytics {
  userGrowth: AdminAnalyticsPoint[]
  moods: AdminAnalyticsPoint[]
  aiUsage: AdminAnalyticsPoint[]
}
// Backend UserDetails (nested inside UserManagementResponseDTO, GET /api/v1/admins/users).
// status is a literal capitalized display string ("Active"/"Suspended") per
// AdminService.getFilteredData, not a lowercase or enum-style value. createdAt is a pre-formatted
// "yyyy-MM-dd" string, not a full ISO timestamp - `new Date(...)` still parses this format fine.
export interface AdminUserSummary {
  id: string
  name: string
  email: string
  status: 'Active' | 'Suspended'
  createdAt: string
}
// Backend UserManagementResponseDTO (GET /api/v1/admins/users).
export interface AdminUsersPage {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  users: AdminUserSummary[]
  currentPage: number
  totalPages: number
  totalItems: number
}
// Mock-mode page size for GET /api/v1/admins/users. The real backend defaults `size` to 10, but
// this frontend sends an explicit `size` query param instead (see getAdminUsers), and keeps this
// smaller value so the small mock user fixture still exercises pagination across 2+ pages. Kept
// here (rather than duplicated in endpoints.ts and mock-store.ts) so both stay in sync.
export const ADMIN_USERS_PAGE_SIZE = 5
// Backend SystemAuditLogs (GET /api/v1/admins/audit-logs). The entity class itself isn't present
// in the available backend source tree, but adminEmail/action/id/timestamp were confirmed from
// constructor/getter usage in AdminService.java, NotificationDashboardService.java, and
// NotificationService.java (`.adminEmail(...)`, `.action(...)`, `.getId()`, `.getTimestamp()`).
export interface AdminAuditLogItem {
  id: number
  action: string
  adminEmail: string
  timestamp: string
}
export interface AdminEmergencyResource {
  id: number
  name: string
  country: string
  resourceType: 'HOTLINE' | 'WEBSITE' | 'CLINIC'
  contactInfo: string
  active: boolean
}
export type AdminEmergencyResourceInput = Omit<AdminEmergencyResource, 'id'>
export interface AdminEmergencyDashboard {
  totalHotlines: number
  totalWebsites: number
  totalClinics: number
  activeCountriesCount: number
  resources: AdminEmergencyResource[]
}
export interface AdminSystemSettings {
  apiConfiguration: { baseUrl: string; apiVersion: string; rateLimitPerMinute: number; timeoutMs: number }
  emailConfiguration: { apiKey: string; senderEmail: string; senderName: string }
  otpConfiguration: { otpLength: number; otpExpiryMinutes: number; maxAttempts: number; deliveryChannel: 'EMAIL' | 'SMS' | 'BOTH' }
  securitySettings: { jwtExpiryMinutes: number; refreshTokenExpiryDays: number; maxLoginAttempts: number; sessionTimeoutMinutes: number; mfaEnabled: boolean; ipWhitelistEnabled: boolean }
  aiConfiguration: {enableAiChat: boolean; aiSystemPromptGenZ: string; aiSystemPromptMillennial: string; aiSystemPromptGenX: string; aiSystemPromptDefault: string;
  }
}
// Same shape as AdminSystemSettings, except emailConfiguration.apiKey is optional. The settings
// page's Save action must be able to send a PATCH that omits apiKey entirely - not an empty string,
// not the possibly-empty fetched/masked value - whenever the admin didn't actually type a new key,
// so the backend's own `!= null` skip-write check is the thing that decides whether the stored key
// changes, rather than the frontend guessing at a value to resend.
export type AdminSystemSettingsUpdate = Omit<AdminSystemSettings, 'emailConfiguration'> & {
  emailConfiguration: Omit<AdminSystemSettings['emailConfiguration'], 'apiKey'> & { apiKey?: string }
}
export type AdminSettingResetKey =
  | 'api_base_url' | 'api_version' | 'api_rate_limit_per_minute' | 'api_timeout_ms'
  | 'email_api_key' | 'email_sender_email' | 'email_sender_name'
  | 'otp_length' | 'otp_expiry_minutes' | 'otp_max_attempts' | 'otp_delivery_channel'
  | 'jwt_expiry_minutes' | 'jwt_refresh_expiry_days' | 'security_max_login_attempts'
  | 'session_timeout_minutes' | 'security_mfa_enabled' | 'security_ip_whitelist_enabled'
  | 'enable_ai_chat' 
  | 'ai_system_prompt_genz' 
  | 'ai_system_prompt_millennial' 
  | 'ai_system_prompt_genx' 
  | 'ai_system_prompt_default';
export interface AdminTelemetryPoint {
  date: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
}
export interface AdminTelemetry {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatencyMs: number
  providerStatus: 'OPERATIONAL' | 'OFFLINE'
  requestTimeline: AdminTelemetryPoint[]
}
