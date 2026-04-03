import React from 'react';
import { cn } from '@/lib/utils';

interface GameLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const GameLayout: React.FC<GameLayoutProps> = ({ children, className }) => {
  return (
    <div className="min-h-screen w-full bg-[#0B0F2E] text-[#F5F0E8] overflow-x-hidden relative flex flex-col items-center p-4 py-8">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(#2A3468 1px, transparent 1px),
            linear-gradient(90deg, #2A3468 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      {/* Subtle orange glow top-left */}
      <div className="absolute top-[-5%] left-[-5%] w-[35%] h-[35%] rounded-full bg-[#FF6B1A]/8 blur-[120px] pointer-events-none" />
      {/* Subtle cyan glow bottom-right */}
      <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] rounded-full bg-[#00FFE5]/6 blur-[120px] pointer-events-none" />

      <div className={cn("relative z-10 w-full max-w-5xl", className)}>
        {children}
      </div>
    </div>
  );
};

export default GameLayout;
