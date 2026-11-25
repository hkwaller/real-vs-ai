import React from 'react'
import { cn } from '@/lib/utils'

interface CountdownRingProps {
  /** seconds remaining */
  value: number
  /** total seconds in the round (kept for callers; the disc shows only the value) */
  total?: number
  /** outer diameter in px */
  size?: number
  /** small line under the number, e.g. "SEC" or "+92 PTS" */
  caption?: string
  /** @deprecated use caption */
  showCaption?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * The seam timer: a white disc with an ink outline that sits on the line
 * between A and B. The value turns orange in the last 3 seconds.
 */
const CountdownRing: React.FC<CountdownRingProps> = ({
  value,
  size = 156,
  caption,
  showCaption = false,
  className,
  style,
}) => {
  const urgent = value <= 3
  const border = Math.max(4, Math.round(size / 20))
  const label = caption ?? (showCaption ? 'SEC' : undefined)

  return (
    <div
      className={cn('seam-disc shrink-0', className)}
      style={{ width: size, height: size, borderWidth: border, ...style }}
      role="timer"
      aria-label={`${value} seconds left`}
    >
      <span
        className="font-black leading-[0.9] tabular-nums font-wide"
        style={{ fontSize: size * 0.4, color: urgent ? 'var(--side-a)' : 'var(--ink)' }}
      >
        {value}
      </span>
      {label && (
        <span className="type-label" style={{ fontSize: Math.max(11, size * 0.09) }}>
          {label}
        </span>
      )}
    </div>
  )
}

export default CountdownRing
