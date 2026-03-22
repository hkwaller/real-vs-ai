import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'

const AdBanner: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-4 py-2 bg-black/80 backdrop-blur-sm border-t border-white/10">
      {/* Ad slot */}
      <div className="flex-1 min-w-0 flex items-center justify-center h-10 bg-white/5 border border-white/10 rounded text-xs text-muted-foreground tracking-widest uppercase select-none">
        Advertisement
      </div>

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
