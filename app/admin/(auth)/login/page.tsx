// app/admin/(auth)/login/page.tsx
'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { adminLogin } from '@/lib/api/admin/endpoints'
import { ApiError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { AdminAuthCard } from '@/components/admin/auth-card'

// 🚨 NEW: Standard SVG Eye Icons
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  )
}

function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false) // 🚨 NEW STATE

  function safeNext(): string {
    const next = params.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next
    return '/admin/dashboard'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await adminLogin(email, password)
      router.replace(safeNext())
    } catch (err) {
      setError(err instanceof ApiError ? err.friendly : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  return (
    <AdminAuthCard title="Admin sign in" subtitle="Manage the EARS FOR YOU platform.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error ? <p role="alert" className="text-sm text-clay">{error}</p> : null}
        
        <Field label="Email" type="email" autoComplete="email" required
          value={email} onChange={e => setEmail(e.target.value)} />
        
        {/* 🚨 UPDATED: Relative wrapper with absolute icon button */}
        <div className="relative">
          <Field label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)} />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-[36px] text-fir/60 hover:text-fir transition-colors focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        <Button type="submit" busy={busy}>Sign in</Button>
        
        <Link
          className="self-center rounded text-sm underline underline-offset-4 opacity-70
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
          href="/admin/forgot-password"
        >
          Forgot password?
        </Link>
        <Link
          className="self-center rounded text-xs underline underline-offset-4 opacity-50
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
          href="/admin/register"
        >
          Need an admin account?
        </Link>
      </form>
    </AdminAuthCard>
  )
}

export default function AdminLoginPage() {
  return <Suspense><AdminLoginForm /></Suspense>
}