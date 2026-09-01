'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { registerUser } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { passwordIssue } from '@/lib/password'
import type { RegisterPayload } from '@/lib/api/types'
import { CompactHero } from '@/components/listening/compact-hero'

const COUNTRIES = [
  'Nigeria', 'United States', 'United Kingdom', 'Canada', 'Ghana', 'Kenya',
  'South Africa', 'India', 'Australia', 'Germany', 'France', 'Ireland',
  'Netherlands', 'Sweden', 'Spain', 'Italy', 'Brazil', 'Mexico',
  'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'Ethiopia', 'Uganda',
  'Rwanda', 'Cameroon', 'Philippines', 'Singapore', 'Malaysia', 'China', 'Japan',
]

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say']
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced']
const EMPLOYMENT_STATUSES = ['Student', 'Employed', 'Self Employed', 'Unemployed']

const EMAIL_RE = /.+@.+\..+/

function maxDob(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 13)
  return d.toISOString().slice(0, 10)
}

const selectClass = 'w-full rounded-xl border-[1.5px] border-fir/30 bg-card px-4 py-3 text-[15px]'
  + ' outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25'

function SelectField({ label, value, onChange, options }:
  { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

type Draft = RegisterPayload & { confirmPassword: string }

const EMPTY_DRAFT: Draft = {
  name: '', gender: '', email: '', password: '', confirmPassword: '',
  dateOfBirth: '', maritalStatus: '', employmentStatus: '', country: '',
}

function StepShell({ children, stepKey }: { children: ReactNode; stepKey: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false) // 🚨 NEW STATE

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  const step1Valid = draft.name.trim().length > 0 && EMAIL_RE.test(draft.email)
  const step2Valid = !!draft.gender && !!draft.country && !!draft.dateOfBirth
    && !!draft.maritalStatus && !!draft.employmentStatus
  const pwIssue = passwordIssue(draft.password)
  const step3Valid = !pwIssue && draft.password === draft.confirmPassword

  function goToStep2(e: React.FormEvent) {
    e.preventDefault()
    if (step1Valid) setStep(2)
  }

  function goToStep3(e: React.FormEvent) {
    e.preventDefault()
    if (step2Valid) setStep(3)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!step3Valid) return
    setBusy(true); setError(null)
    try {
      const payload: RegisterPayload = {
        name: draft.name, gender: draft.gender, email: draft.email, password: draft.password,
        dateOfBirth: draft.dateOfBirth, maritalStatus: draft.maritalStatus,
        employmentStatus: draft.employmentStatus, country: draft.country,
      }
      await registerUser(payload)
      router.push('/verify?email=' + encodeURIComponent(draft.email))
    } catch (err) {
      setError(err instanceof ApiError ? err.friendly : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  return (
    <main>
      <CompactHero step={`Step ${step} of 3`} title="Let's start with you." onBack={() => router.back()} />
      <div className="mx-auto -mt-7 max-w-[420px] rounded-t-[26px] bg-oat px-6 pb-10 pt-7
        shadow-[0_-8px_24px_rgba(0,0,0,.05)]">
        <StepShell stepKey={step}>
          {step === 1 ? (
            <form onSubmit={goToStep2} className="flex flex-col gap-4">
              <Field label="Name" autoComplete="name" required
                value={draft.name} onChange={e => set('name', e.target.value)} />
              <Field label="Email" type="email" autoComplete="email" required
                value={draft.email} onChange={e => set('email', e.target.value)} />
              <Button type="submit" disabled={!step1Valid}>Continue</Button>
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={goToStep3} className="flex flex-col gap-4">
              <SelectField label="Gender" value={draft.gender}
                onChange={v => set('gender', v)} options={GENDERS} />
              <SelectField label="Country" value={draft.country}
                onChange={v => set('country', v)} options={COUNTRIES} />
              <label className="block">
                <span className="block text-sm font-medium mb-1.5">Date of birth</span>
                <input type="date" required max={maxDob()} value={draft.dateOfBirth}
                  onChange={e => set('dateOfBirth', e.target.value)} className={selectClass} />
              </label>
              <SelectField label="Marital status" value={draft.maritalStatus}
                onChange={v => set('maritalStatus', v)} options={MARITAL_STATUSES} />
              <SelectField label="Employment status" value={draft.employmentStatus}
                onChange={v => set('employmentStatus', v)} options={EMPLOYMENT_STATUSES} />
              <p className="text-sm text-fir/70">
                Why we ask: it shapes how the companion talks with you. Never shown to anyone.
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={!step2Valid} className="flex-1">Continue</Button>
              </div>
            </form>
          ) : null}

          {step === 3 ? (
            <form onSubmit={submit} className="flex flex-col gap-4">
              
              {/* 🚨 NEW: Show/Hide Toggle Button */}
              <div className="flex justify-end -mb-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[13px] font-medium text-fir/70 underline underline-offset-4 hover:text-fir transition-colors"
                >
                  {showPassword ? 'Hide passwords' : 'Show passwords'}
                </button>
              </div>

              {/* 🚨 UPDATED: type bound to showPassword state */}
              <Field label="Password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                value={draft.password} onChange={e => set('password', e.target.value)}
                error={draft.password.length > 0 ? pwIssue ?? undefined : undefined} />
              
              <Field label="Confirm password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                value={draft.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                error={error ?? undefined} />
                
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" busy={busy} disabled={!step3Valid} className="flex-1">
                  Create account
                </Button>
              </div>
            </form>
          ) : null}
        </StepShell>
      </div>
    </main>
  )
}