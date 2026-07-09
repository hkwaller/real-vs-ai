import React from 'react'

interface CountdownRingProps {
  /** seconds remaining */
  value: number
  /** total seconds in the round */
  total: number
  /** outer diameter in px */
  size?: number
  /** stroke width in px */
  stroke?: number
  /** show a "seconds" caption under the number */
  showCaption?: boolean
  className?: string
}

/**
 * Circular SVG countdown. Coral arc that drains with the timer; turns red and
 * pulses when 5 seconds or fewer remain.
 */
const CountdownRing: React.FC<CountdownRingProps> = ({
  value,
  total,
  size = 76,
  stroke = 6,
  showCaption = false,
  className,
}) => {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0
  const offset = circumference * (1 - pct)
  const urgent = value <= 5
  const color = urgent ? '#FF6A6A' : '#FF8552'

  return (
    <div
      className={`relative inline-flex items-center justify-center ${urgent ? 'animate-pulse' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-extrabold leading-none"
          style={{ fontSize: size * 0.32, color: urgent ? '#FF6A6A' : '#FFF8F0' }}
        >
          {value}
        </span>
        {showCaption && (
          <span className="font-body text-[#9AA3D0]" style={{ fontSize: size * 0.11 }}>
            seconds
          </span>
        )}
      </div>
    </div>
  )
}

export default CountdownRing
