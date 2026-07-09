import React from 'react'
import { cn } from '@/lib/utils'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

const GameLayout: React.FC<GameLayoutProps> = ({ children, className }) => {
  return (
    <div className="cosmic-bg min-h-screen w-full text-[#FFF8F0] overflow-x-hidden relative flex flex-col items-center p-4 py-8">
      {/* Large blurred coral glow, off-canvas top-right */}
      <div className="absolute top-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#FF8552]/[0.12] blur-[90px] pointer-events-none" />

      <div className={cn('relative z-10 w-full max-w-5xl', className)}>{children}</div>
    </div>
  )
}

export default GameLayout
