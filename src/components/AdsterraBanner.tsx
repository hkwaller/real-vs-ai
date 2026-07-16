import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAdFree } from '@/hooks/useAdFree'

const BANNER_KEY = import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined

type Props = {
  /**
   * External suppression (e.g. the multiplayer host perk). The component also
   * self-gates on the local entitlement; this is an extra OR for callers that
   * live inside a room. Defaults to false for non-room pages.
   */
  suppressed?: boolean
  className?: string
}

/**
 * Adsterra 468x60 banner, self-gating on the ad-free entitlement. Renders
 * nothing while Clerk hydrates, when ad-free, or when no key is configured.
 * A small "Remove ads" link doubles as the upsell entry point.
 */
const AdsterraBanner: React.FC<Props> = ({ suppressed = false, className }) => {
  const { isAdFree, isLoaded } = useAdFree()
  const containerRef = useRef<HTMLDivElement>(null)

  const hidden = !isLoaded || isAdFree || suppressed || !BANNER_KEY

  useEffect(() => {
    if (hidden || !containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''

    const conf = document.createElement('script')
    conf.type = 'text/javascript'
    conf.text = `atOptions = { 'key' : '${BANNER_KEY}', 'format' : 'iframe', 'height' : 60, 'width' : 468, 'params' : {} };`

    const invoke = document.createElement('script')
    invoke.type = 'text/javascript'
    invoke.src = `https://www.highperformanceformat.com/${BANNER_KEY}/invoke.js`

    container.appendChild(conf)
    container.appendChild(invoke)

    return () => {
      container.innerHTML = ''
    }
  }, [hidden])

  if (hidden) return null

  return (
    <div
      className={
        'fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center gap-1 px-4 py-2 bg-[#0B0F2E]/90 backdrop-blur-sm border-t border-white/10 ' +
        (className ?? '')
      }
    >
      <div
        ref={containerRef}
        className="flex items-center justify-center min-h-[60px] w-[468px] max-w-full overflow-hidden"
      />
      <Link
        to="/go-ad-free"
        className="flex items-center gap-1.5 text-xs font-medium text-[#FFB830] hover:text-[#FFD26A] transition-colors whitespace-nowrap"
      >
        <Zap className="w-3.5 h-3.5" />
        Remove ads
      </Link>
    </div>
  )
}

export default AdsterraBanner
