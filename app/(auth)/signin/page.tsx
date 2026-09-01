'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'

// NEW: Standard SVG Eye Icons
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

function SignInForm() {
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
    return '/home'
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await login(email, password)
      router.replace(safeNext())
    } catch (err) {
      // The backend now always returns a real message body (see
      // docs/BACKEND-NOTES.md), so err.friendly already carries the right
      // sentence, whether that's "Incorrect email or password." or a
      // cold-start notice, without us guessing from the status code.
      setError(err instanceof ApiError ? err.friendly : 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <section className="relative flex h-[340px] flex-none items-center justify-center overflow-hidden text-warm-cream lg:h-auto lg:w-[46%]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 660" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
          <defs>
            <linearGradient id="si-scrim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#170F07" />
              <stop offset="1" stopColor="#2A1B0C" />
            </linearGradient>
            <radialGradient id="si-glow" cx=".5" cy=".42" r=".55">
              <stop offset="0" stopColor="#F2BE45" stopOpacity=".24" />
              <stop offset="1" stopColor="#F2BE45" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="620" height="660" fill="url(#si-scrim)" />
          <circle cx="310" cy="280" r="230" fill="url(#si-glow)" />
          <circle cx="310" cy="280" r="100" fill="none" stroke="#FBEEDD" strokeWidth="1.3" opacity=".12" />
          <circle cx="310" cy="280" r="150" fill="none" stroke="#FBEEDD" strokeWidth="1" opacity=".08" />
          <circle cx="120" cy="90" r="1.3" fill="#F6E7B8" opacity=".5" />
          <circle cx="500" cy="140" r="1" fill="#F6E7B8" opacity=".4" />
        </svg>
        <div className="relative z-[3] px-10 text-center">
          <h1 className="font-display text-[42px] font-semibold leading-none text-white">
            Ears<br />for <span className="text-[#F7CB5C]">you.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[30ch] text-[15px] leading-[1.55] text-warm-cream/85">
            A safe space to talk, whenever you need it. No agenda, no judgment.
          </p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-oat px-6 py-10">
        <form onSubmit={submit} className="flex w-full max-w-[320px] flex-col gap-4">
          <h2 className="mb-1 font-display text-[22px] font-semibold">Welcome back.</h2>
          
          <Field label="Email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)} />
          
          {/* UPDATED: Relative wrapper with absolute icon button */}
          <div className="relative">
            <Field label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
              value={password} onChange={e => setPassword(e.target.value)} error={error ?? undefined} />
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
          <Button type="button" variant="ghost" onClick={() => router.push('/register')}>Create an account</Button>
          
          <Link
            className="self-center rounded text-sm underline underline-offset-4 opacity-80
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </form>
      </section>
    </main>
  )
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>
}