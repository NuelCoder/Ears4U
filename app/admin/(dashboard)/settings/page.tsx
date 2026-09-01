'use client'
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminSettings, updateAdminSettings, resetAdminSetting } from '@/lib/api/admin/endpoints'
import { adminQk } from '@/lib/query/admin-keys'
import { errorMessage } from '@/lib/api/errors'
import type { AdminSystemSettings, AdminSettingResetKey } from '@/lib/api/admin/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'

const DELIVERY_CHANNELS: AdminSystemSettings['otpConfiguration']['deliveryChannel'][] = ['EMAIL', 'SMS', 'BOTH']

type SettingsFormState = {
  apiConfiguration: { baseUrl: string; apiVersion: string; rateLimitPerMinute: string; timeoutMs: string }
  emailConfiguration: AdminSystemSettings['emailConfiguration']
  otpConfiguration: {
    otpLength: string; otpExpiryMinutes: string; maxAttempts: string
    deliveryChannel: AdminSystemSettings['otpConfiguration']['deliveryChannel']
  }
  securitySettings: {
    jwtExpiryMinutes: string; refreshTokenExpiryDays: string; maxLoginAttempts: string; sessionTimeoutMinutes: string
    mfaEnabled: boolean; ipWhitelistEnabled: boolean
  }
  aiConfiguration: AdminSystemSettings['aiConfiguration']
}

function toFormState(s: AdminSystemSettings): SettingsFormState {
  return {
    apiConfiguration: {
      baseUrl: s.apiConfiguration.baseUrl,
      apiVersion: s.apiConfiguration.apiVersion,
      rateLimitPerMinute: String(s.apiConfiguration.rateLimitPerMinute),
      timeoutMs: String(s.apiConfiguration.timeoutMs),
    },
    emailConfiguration: { ...s.emailConfiguration },
    otpConfiguration: {
      otpLength: String(s.otpConfiguration.otpLength),
      otpExpiryMinutes: String(s.otpConfiguration.otpExpiryMinutes),
      maxAttempts: String(s.otpConfiguration.maxAttempts),
      deliveryChannel: s.otpConfiguration.deliveryChannel,
    },
    securitySettings: {
      jwtExpiryMinutes: String(s.securitySettings.jwtExpiryMinutes),
      refreshTokenExpiryDays: String(s.securitySettings.refreshTokenExpiryDays),
      maxLoginAttempts: String(s.securitySettings.maxLoginAttempts),
      sessionTimeoutMinutes: String(s.securitySettings.sessionTimeoutMinutes),
      mfaEnabled: s.securitySettings.mfaEnabled,
      ipWhitelistEnabled: s.securitySettings.ipWhitelistEnabled,
    },
    aiConfiguration: { ...s.aiConfiguration },
  }
}

const NUMERIC_FIELD_ERROR = 'Enter a whole number of at least 1.'

function parseValidNumber(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? n : null
}

function numericFieldError(raw: string): string | undefined {
  return parseValidNumber(raw) === null ? NUMERIC_FIELD_ERROR : undefined
}

function toSettingsPayload(form: SettingsFormState): AdminSystemSettings | null {
  const rateLimitPerMinute = parseValidNumber(form.apiConfiguration.rateLimitPerMinute)
  const timeoutMs = parseValidNumber(form.apiConfiguration.timeoutMs)
  const otpLength = parseValidNumber(form.otpConfiguration.otpLength)
  const otpExpiryMinutes = parseValidNumber(form.otpConfiguration.otpExpiryMinutes)
  const maxAttempts = parseValidNumber(form.otpConfiguration.maxAttempts)
  const jwtExpiryMinutes = parseValidNumber(form.securitySettings.jwtExpiryMinutes)
  const refreshTokenExpiryDays = parseValidNumber(form.securitySettings.refreshTokenExpiryDays)
  const maxLoginAttempts = parseValidNumber(form.securitySettings.maxLoginAttempts)
  const sessionTimeoutMinutes = parseValidNumber(form.securitySettings.sessionTimeoutMinutes)
  
  if (
    rateLimitPerMinute === null || timeoutMs === null || otpLength === null || otpExpiryMinutes === null ||
    maxAttempts === null || jwtExpiryMinutes === null || refreshTokenExpiryDays === null ||
    maxLoginAttempts === null || sessionTimeoutMinutes === null
  ) {
    return null
  }
  
  return {
    apiConfiguration: { baseUrl: form.apiConfiguration.baseUrl, apiVersion: form.apiConfiguration.apiVersion, rateLimitPerMinute, timeoutMs },
    emailConfiguration: form.emailConfiguration,
    otpConfiguration: { otpLength, otpExpiryMinutes, maxAttempts, deliveryChannel: form.otpConfiguration.deliveryChannel },
    securitySettings: {
      jwtExpiryMinutes, refreshTokenExpiryDays, maxLoginAttempts, sessionTimeoutMinutes,
      mfaEnabled: form.securitySettings.mfaEnabled, ipWhitelistEnabled: form.securitySettings.ipWhitelistEnabled,
    },
    aiConfiguration: form.aiConfiguration,
  }
}

const RESET_KEY_APPLY: Record<AdminSettingResetKey, (form: SettingsFormState, fresh: AdminSystemSettings) => SettingsFormState> = {
  api_base_url: (f, fresh) => ({ ...f, apiConfiguration: { ...f.apiConfiguration, baseUrl: fresh.apiConfiguration.baseUrl } }),
  api_version: (f, fresh) => ({ ...f, apiConfiguration: { ...f.apiConfiguration, apiVersion: fresh.apiConfiguration.apiVersion } }),
  api_rate_limit_per_minute: (f, fresh) => ({ ...f, apiConfiguration: { ...f.apiConfiguration, rateLimitPerMinute: String(fresh.apiConfiguration.rateLimitPerMinute) } }),
  api_timeout_ms: (f, fresh) => ({ ...f, apiConfiguration: { ...f.apiConfiguration, timeoutMs: String(fresh.apiConfiguration.timeoutMs) } }),
  email_api_key: (f, fresh) => ({ ...f, emailConfiguration: { ...f.emailConfiguration, apiKey: fresh.emailConfiguration.apiKey } }),
  email_sender_email: (f, fresh) => ({ ...f, emailConfiguration: { ...f.emailConfiguration, senderEmail: fresh.emailConfiguration.senderEmail } }),
  email_sender_name: (f, fresh) => ({ ...f, emailConfiguration: { ...f.emailConfiguration, senderName: fresh.emailConfiguration.senderName } }),
  otp_length: (f, fresh) => ({ ...f, otpConfiguration: { ...f.otpConfiguration, otpLength: String(fresh.otpConfiguration.otpLength) } }),
  otp_expiry_minutes: (f, fresh) => ({ ...f, otpConfiguration: { ...f.otpConfiguration, otpExpiryMinutes: String(fresh.otpConfiguration.otpExpiryMinutes) } }),
  otp_max_attempts: (f, fresh) => ({ ...f, otpConfiguration: { ...f.otpConfiguration, maxAttempts: String(fresh.otpConfiguration.maxAttempts) } }),
  otp_delivery_channel: (f, fresh) => ({ ...f, otpConfiguration: { ...f.otpConfiguration, deliveryChannel: fresh.otpConfiguration.deliveryChannel } }),
  jwt_expiry_minutes: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, jwtExpiryMinutes: String(fresh.securitySettings.jwtExpiryMinutes) } }),
  jwt_refresh_expiry_days: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, refreshTokenExpiryDays: String(fresh.securitySettings.refreshTokenExpiryDays) } }),
  security_max_login_attempts: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, maxLoginAttempts: String(fresh.securitySettings.maxLoginAttempts) } }),
  session_timeout_minutes: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, sessionTimeoutMinutes: String(fresh.securitySettings.sessionTimeoutMinutes) } }),
  security_mfa_enabled: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, mfaEnabled: fresh.securitySettings.mfaEnabled } }),
  security_ip_whitelist_enabled: (f, fresh) => ({ ...f, securitySettings: { ...f.securitySettings, ipWhitelistEnabled: fresh.securitySettings.ipWhitelistEnabled } }),
  enable_ai_chat: (f, fresh) => ({ ...f, aiConfiguration: { ...f.aiConfiguration, enableAiChat: fresh.aiConfiguration.enableAiChat } }),
  
  // 🚨 NEW: 4 separate Generational Prompt Reset Keys
  ai_system_prompt_genz: (f, fresh) => ({ ...f, aiConfiguration: { ...f.aiConfiguration, aiSystemPromptGenZ: fresh.aiConfiguration.aiSystemPromptGenZ } }),
  ai_system_prompt_millennial: (f, fresh) => ({ ...f, aiConfiguration: { ...f.aiConfiguration, aiSystemPromptMillennial: fresh.aiConfiguration.aiSystemPromptMillennial } }),
  ai_system_prompt_genx: (f, fresh) => ({ ...f, aiConfiguration: { ...f.aiConfiguration, aiSystemPromptGenX: fresh.aiConfiguration.aiSystemPromptGenX } }),
  ai_system_prompt_default: (f, fresh) => ({ ...f, aiConfiguration: { ...f.aiConfiguration, aiSystemPromptDefault: fresh.aiConfiguration.aiSystemPromptDefault } }),
}

function ResetAction({ label, settingKey, onReset }: {
  label: string
  settingKey: AdminSettingResetKey
  onReset: (key: AdminSettingResetKey) => void
}) {
  const mutation = useMutation({
    mutationFn: () => resetAdminSetting(settingKey),
    onSuccess: () => onReset(settingKey),
  })
  return (
    <div className="flex shrink-0 flex-col items-end gap-1 self-end sm:self-auto">
      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        aria-label={`Reset ${label} to default`}
        className="inline-flex min-h-11 items-center text-sm text-fir/60 underline underline-offset-4
          disabled:opacity-50
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
      >
        {mutation.isPending ? 'Resetting…' : 'Reset to default'}
      </button>
      {mutation.isError ? <span role="alert" className="text-xs text-clay">{errorMessage(mutation.error)}</span> : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card px-5 py-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4 flex flex-col gap-5">{children}</div>
    </section>
  )
}

function FieldRow({ label, settingKey, onReset, children }: {
  label: string
  settingKey: AdminSettingResetKey
  onReset: (key: AdminSettingResetKey) => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      <ResetAction label={label} settingKey={settingKey} onReset={onReset} />
    </div>
  )
}

function ToggleRow({ label, checked, onChange, settingKey, onReset }: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  settingKey: AdminSettingResetKey
  onReset: (key: AdminSettingResetKey) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <Toggle label={label} checked={checked} onChange={onChange} />
      </div>
      <div className="flex justify-end">
        <ResetAction label={label} settingKey={settingKey} onReset={onReset} />
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card px-5 py-4">
          <Skeleton lines={4} />
        </div>
      ))}
    </div>
  )
}

function SettingsForm({ settings }: { settings: AdminSystemSettings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SettingsFormState>(() => toFormState(settings))
  const [apiKeyDraft, setApiKeyDraft] = useState<string | null>(null)

  const isFormValid = toSettingsPayload(form) !== null

  async function refetchSettings(): Promise<AdminSystemSettings | null> {
    try {
      return await queryClient.fetchQuery({ queryKey: adminQk.settings, queryFn: getAdminSettings, staleTime: 0 })
    } catch {
      return null
    }
  }

  async function handleReset(key: AdminSettingResetKey) {
    void queryClient.invalidateQueries({ queryKey: adminQk.auditLogs })
    const fresh = await refetchSettings()
    if (fresh) {
      setForm(f => RESET_KEY_APPLY[key](f, fresh))
      if (key === 'email_api_key') setApiKeyDraft(null)
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const base = toSettingsPayload(form)
      if (!base) throw new Error('Fix the highlighted fields before saving.')
      const trimmedDraft = apiKeyDraft?.trim() || ''
      if (trimmedDraft) {
        return updateAdminSettings({ ...base, emailConfiguration: { ...base.emailConfiguration, apiKey: trimmedDraft } })
      }
      return updateAdminSettings({
        ...base,
        emailConfiguration: { senderEmail: base.emailConfiguration.senderEmail, senderName: base.emailConfiguration.senderName },
      })
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: adminQk.auditLogs })
      const fresh = await refetchSettings()
      if (fresh) {
        setForm(toFormState(fresh))
        setApiKeyDraft(null)
      }
    },
  })

  function set<K extends keyof SettingsFormState>(section: K, patch: Partial<SettingsFormState[K]>) {
    setForm(f => ({ ...f, [section]: { ...f[section], ...patch } }))
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (isFormValid) saveMutation.mutate() }}
      className="flex flex-col gap-4"
    >
      {saveMutation.isError ? (
        <p role="alert" className="text-sm text-clay">{errorMessage(saveMutation.error)}</p>
      ) : null}

      <Section title="API Configuration">
        <FieldRow label="Base URL" settingKey="api_base_url" onReset={handleReset}>
          <Field label="Base URL" value={form.apiConfiguration.baseUrl}
            onChange={e => set('apiConfiguration', { baseUrl: e.target.value })} />
        </FieldRow>
        <FieldRow label="API version" settingKey="api_version" onReset={handleReset}>
          <Field label="API version" value={form.apiConfiguration.apiVersion}
            onChange={e => set('apiConfiguration', { apiVersion: e.target.value })} />
        </FieldRow>
        <FieldRow label="Rate limit (per minute)" settingKey="api_rate_limit_per_minute" onReset={handleReset}>
          <Field label="Rate limit (per minute)" type="number" min={1} value={form.apiConfiguration.rateLimitPerMinute}
            onChange={e => set('apiConfiguration', { rateLimitPerMinute: e.target.value })}
            error={numericFieldError(form.apiConfiguration.rateLimitPerMinute)} />
        </FieldRow>
        <FieldRow label="Timeout (ms)" settingKey="api_timeout_ms" onReset={handleReset}>
          <Field label="Timeout (ms)" type="number" min={1} value={form.apiConfiguration.timeoutMs}
            onChange={e => set('apiConfiguration', { timeoutMs: e.target.value })}
            error={numericFieldError(form.apiConfiguration.timeoutMs)} />
        </FieldRow>
      </Section>

      <Section title="Email Configuration">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            {apiKeyDraft === null ? (
              <>
                <span className="block text-sm font-medium mb-1.5">API key</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl border-[1.5px] border-fir/15 bg-oat px-4 py-3 text-[15px] font-mono">
                    {form.emailConfiguration.apiKey || '(not set)'}
                  </span>
                  <Button type="button" variant="ghost" onClick={() => setApiKeyDraft('')}>
                    Change API key
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Field label="New API key" autoComplete="off" value={apiKeyDraft}
                    onChange={e => setApiKeyDraft(e.target.value)} />
                </div>
                <Button type="button" variant="ghost" onClick={() => setApiKeyDraft(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <ResetAction label="API key" settingKey="email_api_key" onReset={handleReset} />
        </div>
        <FieldRow label="Sender email" settingKey="email_sender_email" onReset={handleReset}>
          <Field label="Sender email" type="email" value={form.emailConfiguration.senderEmail}
            onChange={e => set('emailConfiguration', { senderEmail: e.target.value })} />
        </FieldRow>
        <FieldRow label="Sender name" settingKey="email_sender_name" onReset={handleReset}>
          <Field label="Sender name" value={form.emailConfiguration.senderName}
            onChange={e => set('emailConfiguration', { senderName: e.target.value })} />
        </FieldRow>
      </Section>

      <Section title="OTP Configuration">
        <FieldRow label="OTP length" settingKey="otp_length" onReset={handleReset}>
          <Field label="OTP length" type="number" min={1} value={form.otpConfiguration.otpLength}
            onChange={e => set('otpConfiguration', { otpLength: e.target.value })}
            error={numericFieldError(form.otpConfiguration.otpLength)} />
        </FieldRow>
        <FieldRow label="OTP expiry (minutes)" settingKey="otp_expiry_minutes" onReset={handleReset}>
          <Field label="OTP expiry (minutes)" type="number" min={1} value={form.otpConfiguration.otpExpiryMinutes}
            onChange={e => set('otpConfiguration', { otpExpiryMinutes: e.target.value })}
            error={numericFieldError(form.otpConfiguration.otpExpiryMinutes)} />
        </FieldRow>
        <FieldRow label="Max attempts" settingKey="otp_max_attempts" onReset={handleReset}>
          <Field label="Max attempts" type="number" min={1} value={form.otpConfiguration.maxAttempts}
            onChange={e => set('otpConfiguration', { maxAttempts: e.target.value })}
            error={numericFieldError(form.otpConfiguration.maxAttempts)} />
        </FieldRow>
        <div className="flex flex-col gap-2">
          <p id="delivery-channel-label" className="text-sm font-medium">Delivery channel</p>
          <div role="group" aria-labelledby="delivery-channel-label" className="flex gap-2">
            {DELIVERY_CHANNELS.map(opt => (
              <button
                key={opt}
                type="button"
                aria-pressed={form.otpConfiguration.deliveryChannel === opt}
                onClick={() => set('otpConfiguration', { deliveryChannel: opt })}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  form.otpConfiguration.deliveryChannel === opt
                    ? 'border-fir bg-fir text-oat'
                    : 'border-fir/15 bg-oat'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <ResetAction label="Delivery channel" settingKey="otp_delivery_channel" onReset={handleReset} />
          </div>
        </div>
      </Section>

      <Section title="Security Settings">
        <FieldRow label="JWT expiry (minutes)" settingKey="jwt_expiry_minutes" onReset={handleReset}>
          <Field label="JWT expiry (minutes)" type="number" min={1} value={form.securitySettings.jwtExpiryMinutes}
            onChange={e => set('securitySettings', { jwtExpiryMinutes: e.target.value })}
            error={numericFieldError(form.securitySettings.jwtExpiryMinutes)} />
        </FieldRow>
        <FieldRow label="Refresh token expiry (days)" settingKey="jwt_refresh_expiry_days" onReset={handleReset}>
          <Field label="Refresh token expiry (days)" type="number" min={1} value={form.securitySettings.refreshTokenExpiryDays}
            onChange={e => set('securitySettings', { refreshTokenExpiryDays: e.target.value })}
            error={numericFieldError(form.securitySettings.refreshTokenExpiryDays)} />
        </FieldRow>
        <FieldRow label="Max login attempts" settingKey="security_max_login_attempts" onReset={handleReset}>
          <Field label="Max login attempts" type="number" min={1} value={form.securitySettings.maxLoginAttempts}
            onChange={e => set('securitySettings', { maxLoginAttempts: e.target.value })}
            error={numericFieldError(form.securitySettings.maxLoginAttempts)} />
        </FieldRow>
        <FieldRow label="Session timeout (minutes)" settingKey="session_timeout_minutes" onReset={handleReset}>
          <Field label="Session timeout (minutes)" type="number" min={1} value={form.securitySettings.sessionTimeoutMinutes}
            onChange={e => set('securitySettings', { sessionTimeoutMinutes: e.target.value })}
            error={numericFieldError(form.securitySettings.sessionTimeoutMinutes)} />
        </FieldRow>
        <ToggleRow label="Multi-factor authentication" checked={form.securitySettings.mfaEnabled}
          onChange={next => set('securitySettings', { mfaEnabled: next })}
          settingKey="security_mfa_enabled" onReset={handleReset} />
        <ToggleRow label="IP whitelist" checked={form.securitySettings.ipWhitelistEnabled}
          onChange={next => set('securitySettings', { ipWhitelistEnabled: next })}
          settingKey="security_ip_whitelist_enabled" onReset={handleReset} />
      </Section>

      {/* 🚨 UPDATED: AI Configuration Section now maps the 4 specific prompts */}
      <Section title="AI Configuration">
        <ToggleRow label="Enable AI chat" checked={form.aiConfiguration.enableAiChat}
          onChange={next => set('aiConfiguration', { enableAiChat: next })}
          settingKey="enable_ai_chat" onReset={handleReset} />

        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Gen Z System Prompt</span>
            <textarea
              value={form.aiConfiguration.aiSystemPromptGenZ}
              onChange={e => set('aiConfiguration', { aiSystemPromptGenZ: e.target.value })}
              rows={4}
              className="w-full rounded-xl border-[1.5px] border-fir/30 bg-card px-4 py-3 text-[15px]
                outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
            />
          </label>
          <div className="flex justify-end">
            <ResetAction label="Gen Z System Prompt" settingKey="ai_system_prompt_genz" onReset={handleReset} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Millennial System Prompt</span>
            <textarea
              value={form.aiConfiguration.aiSystemPromptMillennial}
              onChange={e => set('aiConfiguration', { aiSystemPromptMillennial: e.target.value })}
              rows={4}
              className="w-full rounded-xl border-[1.5px] border-fir/30 bg-card px-4 py-3 text-[15px]
                outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
            />
          </label>
          <div className="flex justify-end">
            <ResetAction label="Millennial System Prompt" settingKey="ai_system_prompt_millennial" onReset={handleReset} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Gen X System Prompt</span>
            <textarea
              value={form.aiConfiguration.aiSystemPromptGenX}
              onChange={e => set('aiConfiguration', { aiSystemPromptGenX: e.target.value })}
              rows={4}
              className="w-full rounded-xl border-[1.5px] border-fir/30 bg-card px-4 py-3 text-[15px]
                outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
            />
          </label>
          <div className="flex justify-end">
            <ResetAction label="Gen X System Prompt" settingKey="ai_system_prompt_genx" onReset={handleReset} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Default System Prompt (Fallback)</span>
            <textarea
              value={form.aiConfiguration.aiSystemPromptDefault}
              onChange={e => set('aiConfiguration', { aiSystemPromptDefault: e.target.value })}
              rows={4}
              className="w-full rounded-xl border-[1.5px] border-fir/30 bg-card px-4 py-3 text-[15px]
                outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
            />
          </label>
          <div className="flex justify-end">
            <ResetAction label="Default System Prompt" settingKey="ai_system_prompt_default" onReset={handleReset} />
          </div>
        </div>
      </Section>

      <Button type="submit" busy={saveMutation.isPending} disabled={!isFormValid} className="self-start">
        Save changes
      </Button>
    </form>
  )
}

export default function AdminSettingsPage() {
  const settings = useQuery({ queryKey: adminQk.settings, queryFn: getAdminSettings })

  let content: ReactNode
  if (settings.isError && !settings.data) {
    content = <ErrorState error={settings.error} retry={() => void settings.refetch()} />
  } else if (settings.isLoading || !settings.data) {
    content = <SettingsSkeleton />
  } else {
    content = <SettingsForm settings={settings.data} />
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>
      {content}
    </div>
  )
}