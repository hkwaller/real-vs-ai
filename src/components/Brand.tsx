import React from 'react'
import { cn } from '@/lib/utils'

/** The wordmark: plain wide type, no logo mark. */
export const Wordmark: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('type-display tracking-normal text-[22px] leading-none whitespace-nowrap', className)}>
    Real or AI
  </span>
)

type NameBlockTone = 'paper' | 'blue' | 'ink'

const toneClass: Record<NameBlockTone, string> = {
  paper: 'bg-paper text-ink',
  blue: 'bg-side-b text-paper',
  ink: 'bg-ink text-paper',
}

/** How a player appears everywhere: their name in a flat block. No avatars. */
export const NameBlock: React.FC<{
  name: string
  tone?: NameBlockTone
  small?: boolean
  tag?: string
  className?: string
}> = ({ name, tone = 'paper', small = false, tag, className }) => (
  <span
    className={cn(
      'type-name inline-flex items-center gap-3 leading-none max-w-full',
      small ? 'h-[46px] px-3.5 text-[20px]' : 'h-16 px-[22px] text-[26px]',
      toneClass[tone],
      className,
    )}
  >
    <span className="truncate">{name}</span>
    {tag && (
      <span className="type-label shrink-0 bg-side-a text-ink px-2 py-1 text-[13px] tracking-[0.06em]">
        {tag}
      </span>
    )}
  </span>
)

/** Forward arrow used on buttons that move the game on. */
export const ArrowRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="square"
    aria-hidden="true"
    className={cn('size-[1.1em]', className)}
  >
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </svg>
)

/** Reload arrow for Play again and Swap pair. */
export const ReplayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="square"
    aria-hidden="true"
    className={cn('size-[1.1em]', className)}
  >
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
)

/** The emoji field still exists in presence and storage; new players get this. */
export const NO_EMOJI = ''
