import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

const BANNER_KEY = import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined

const AdBanner: React.FC = () => {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !BANNER_KEY) return

    const container = containerRef.current
    // Clear any previous injection (e.g. React StrictMode double-mount)
    container.innerHTML = ''

    const optionsScript = document.createElement('script')
    optionsScript.type = 'text/javascript'
    optionsScript.text = `
      atOptions = {
        'key': '${BANNER_KEY}',
        'format': 'iframe',
        'height': 60,
        'width': 468,
        'params': {}
      };
    `

    const invokeScript = document.createElement('script')
    invokeScript.type = 'text/javascript'
    invokeScript.src = `//www.topcreativeformat.com/${BANNER_KEY}/invoke.js`

    container.appendChild(optionsScript)
    container.appendChild(invokeScript)

    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-2 bg-black/80 backdrop-blur-sm border-t border-white/10">
      {/* Ad slot */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 flex items-center justify-center h-[60px] overflow-hidden"
      />

      {/* Upgrade CTA */}
      <button
        onClick={() => navigate('/dashboard#pricing')}
        className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors whitespace-nowrap"
      >
        <Zap className="w-3.5 h-3.5" />
        Remove ads — Go Pro
      </button>
    </div>
  )
}

export default AdBanner
