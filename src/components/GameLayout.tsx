import React from 'react'
import { cn } from '@/lib/utils'

interface GameLayoutProps {
  children: React.ReactNode
  className?: string
}

/** Plain paper page with a centred column. Full-bleed game screens don't use it. */
const GameLayout: React.FC<GameLayoutProps> = ({ children, className }) => {
  return (
    <div className="min-h-screen w-full bg-paper text-ink overflow-x-hidden flex flex-col items-center px-4 py-8 md:px-8">
      <div className={cn('w-full max-w-5xl', className)}>{children}</div>
    </div>
  )
}

export default GameLayout
