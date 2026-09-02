'use client'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useReducedMotion } from 'motion/react'
import { getChatHistory, sendChat } from '@/lib/api/endpoints'
import { qk } from '@/lib/query/keys'
import type { ChatMessage } from '@/lib/api/types'
import { Lifeline } from '@/components/lifeline'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'

const WELCOME = "This space is yours. Say whatever is on your mind, I'm listening."
const GAP_MS = 10 * 60 * 1000
// Mirrors the composer wrapper's own `bottom-[calc(env(safe-area-inset-bottom)+108px)]`
// offset below: that's the gap deliberately reserved between the composer and the true
// viewport bottom, so the composer clears the raised "Talk to me" tab button. Content
// clearance (padding + scroll-margin) below the message list must reserve this same gap
// on top of the composer's own (dynamically measured) height, or the last message just
// ends up parked exactly where the composer sticks, underneath it, instead of above it.
const TAB_BUTTON_CLEARANCE = 'calc(env(safe-area-inset-bottom) + 108px)'

type PendingMessage = { id: string; content: string; status: 'pending' | 'failed' }

function normalizeRole(role: string): 'user' | 'assistant' | null {
  const r = role.trim().toLowerCase()
  if (r === 'user') return 'user'
  if (r === 'assistant') return 'assistant'
  return null
}

function formatTimestamp(iso: string, now: Date): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const sameDay = at.toDateString() === now.toDateString()
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

function ChatHeader() {
  return (
    <div className="relative overflow-hidden rounded-b-[22px] bg-gradient-to-b from-night-warm-top to-night-warm-bottom
      px-5 py-4 text-warm-cream lg:rounded-none lg:border-b lg:border-fir/10 lg:bg-none lg:bg-oat lg:text-fir lg:px-6">
      <div className="relative z-[2] flex items-center gap-2.5">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-fir lg:bg-fir">
          <svg viewBox="0 0 24 24" fill="none" stroke="#F7CB5C" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d="M21 12c0 4.4-4 8-9 8-1.2 0-2.4-.2-3.4-.6L3 21l1.8-4.2C3.7 15.4 3 13.8 3 12c0-4.4 4-8 9-8s9 3.6 9 8Z" />
          </svg>
          <i className="absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-oat bg-marigold" />
        </span>
        <span>
          <span className="block font-display text-[14.5px] font-semibold">Your companion</span>
          <span className="block text-[11px] text-marigold lg:text-leaf">Here, listening</span>
        </span>
      </div>
    </div>
  )
}

function ListeningIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      role="status"
      aria-label="Listening"
      className="flex w-fit items-center gap-2 self-start rounded-2xl rounded-bl-sm border-[1.5px]
        border-marigold-deep/20 bg-card px-3.5 py-3"
    >
      <span className="relative block h-4 w-4" aria-hidden>
        <span className={`absolute inset-0 rounded-full border-[1.4px] border-marigold-deep opacity-50
          ${reduceMotion ? '' : 'animate-ping'}`} />
        <span className="absolute inset-[5px] rounded-full bg-marigold" />
      </span>
      <span className="text-[13px] opacity-70">Listening...</span>
    </div>
  )
}

function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Say what's on your mind"
        aria-label="Message"
        className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-fir/30 bg-card px-4 text-[15px]
          outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        aria-label="Send"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br
          from-marigold to-marigold-deep text-fir-deep shadow-lg shadow-marigold-deep/30 transition active:scale-[.98]
          disabled:opacity-50 disabled:pointer-events-none
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  )
}

function ChatSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-5 py-6 lg:px-6">
      <Skeleton lines={2} className="max-w-[70%]" />
      <Skeleton lines={2} className="ml-auto max-w-[70%]" />
      <Skeleton lines={2} className="max-w-[70%]" />
    </div>
  )
}

export default function ChatPage() {
  const queryClient = useQueryClient()
  const reduceMotion = !!useReducedMotion()
  const [pending, setPending] = useState<PendingMessage[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  // Callback ref (not useRef+useEffect with []): the composer only mounts once the
  // loading/error early-returns below have resolved, so the observer must attach
  // whenever the node actually appears, not just once on the component's first mount.
  const [composerNode, setComposerNode] = useState<HTMLDivElement | null>(null)
  const [composerClearance, setComposerClearance] = useState(110)

  useEffect(() => {
    if (!composerNode || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      // +16px: small breathing room below the composer's own footprint (bg-oat/95
      // pb-2 pt-1 wrapper), which the composer's rendered height already includes;
      // this just keeps the last message from sitting flush against it.
      if (entry) setComposerClearance(entry.contentRect.height + 16)
    })
    observer.observe(composerNode)
    return () => observer.disconnect()
  }, [composerNode])

  const history = useQuery({ queryKey: qk.chat, queryFn: getChatHistory })

  const send = useMutation({
    mutationFn: ({ text }: { id: string; text: string }) => sendChat(text),
    onSuccess: (data, variables) => {
      setPending(p => p.filter(m => m.id !== variables.id))
      const reply = data && (data.reply ?? data.response ?? data.message)
      if (typeof reply === 'string' && reply.length > 0) {
        queryClient.setQueryData<ChatMessage[]>(qk.chat, old => [
          ...(old ?? []),
          { content: variables.text, role: 'User', timestamp: new Date().toISOString() },
          { content: reply, role: 'Assistant', timestamp: new Date().toISOString() },
        ])
      } else {
        void queryClient.invalidateQueries({ queryKey: qk.chat })
      }
    },
    onError: (_err, variables) => {
      setPending(p => p.map(m => (m.id === variables.id ? { ...m, status: 'failed' } : m)))
    },
  })

  function sendMessage(text: string, retryId?: string) {
    const id = retryId ?? crypto.randomUUID()
    setPending(p =>
      retryId
        ? p.map(m => (m.id === retryId ? { ...m, status: 'pending' } : m))
        : [...p, { id, content: text, status: 'pending' }]
    )
    send.mutate({ id, text })
  }

 const messages = (history.data ?? [])
    .filter(m => 
      normalizeRole(m.role) !== null && 
      typeof m.content === 'string' && 
      m.content.trim().length > 0
    )
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const isEmpty = messages.length === 0 && pending.length === 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pending.length])

  if (history.isError && !history.data) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10 lg:px-6">
        <ErrorState error={history.error} retry={() => void history.refetch()} />
      </div>
    )
  }
  if (history.isLoading) return <ChatSkeleton />

  const now = new Date()
  const hasPendingSend = pending.some(m => m.status === 'pending')
  const messageListClearance = `calc(${TAB_BUTTON_CLEARANCE} + ${composerClearance}px)`

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-5 pb-4 pt-6 lg:px-6">
      <h1 className="sr-only">Chat</h1>
      <ChatHeader />

      <div
        className="flex flex-col gap-3 pb-(--composer-clearance) lg:pb-4"
        style={{ '--composer-clearance': messageListClearance } as React.CSSProperties}
      >
        {isEmpty ? (
          <div className="max-w-[85%] self-start rounded-2xl rounded-bl-sm border-[1.5px] border-fir/15
            bg-card px-4 py-3 text-[15px] leading-relaxed">
            {WELCOME}
          </div>
        ) : null}

        {messages.map((m, i) => {
          const role = normalizeRole(m.role)
          const prev = messages[i - 1]
          const showTimestamp =
            i === 0 || !prev || new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime() > GAP_MS
          return (
            <div key={`${m.timestamp}-${i}`} className="flex flex-col gap-1">
              {showTimestamp ? (
                <p className={`text-[11px] opacity-50 ${role === 'user' ? 'text-right' : 'text-left'}`}>
                  {formatTimestamp(m.timestamp, now)}
                </p>
              ) : null}
              <div
                className={
                  role === 'user'
                    ? 'max-w-[85%] self-end rounded-2xl rounded-br-sm bg-fir px-4 py-3 text-[15px]'
                      + ' leading-relaxed text-oat'
                    : 'max-w-[85%] self-start rounded-2xl rounded-bl-sm border-[1.5px] border-fir/15 bg-card'
                      + ' px-4 py-3 text-[15px] leading-relaxed'
                }
              >
                {m.content}
              </div>
            </div>
          )
        })}

        {pending.map(m => (
          <div key={m.id} className="flex flex-col gap-2">
            <div
              className={`max-w-[85%] self-end rounded-2xl rounded-br-sm bg-fir px-4 py-3 text-[15px]
                leading-relaxed text-oat ${m.status === 'failed' ? 'opacity-60' : ''}`}
            >
              {m.content}
            </div>
            {m.status === 'failed' ? (
              <button
                type="button"
                onClick={() => sendMessage(m.content, m.id)}
                className="inline-flex min-h-11 items-center self-end text-[13px] text-clay underline
                  underline-offset-4
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fir"
              >
                Not sent. Tap to retry.
              </button>
            ) : (
              <ListeningIndicator reduceMotion={reduceMotion} />
            )}
          </div>
        ))}

        {/* scroll-margin-bottom (not just the container's padding) is what actually
            makes scrollIntoView stop short of the sticky composer below: padding alone
            doesn't move the composer, which sticks at a fixed viewport offset regardless
            of how much space is reserved above it, so scrollIntoView would otherwise drag
            this sentinel (and the real content just above it) flush to the true viewport
            bottom, right underneath the composer. */}
        <div ref={bottomRef} style={{ scrollMarginBottom: messageListClearance } as React.CSSProperties} />
      </div>

      <div
        ref={setComposerNode}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+108px)] z-20 flex flex-col gap-2
        bg-oat/95 pb-2 pt-1 backdrop-blur lg:sticky lg:bottom-4"
      >
        <Lifeline />
        <Composer disabled={hasPendingSend} onSend={sendMessage} />
      </div>
    </div>
  )
}
