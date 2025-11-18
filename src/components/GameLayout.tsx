import React from 'react';
import { cn } from '@/lib/utils';

interface GameLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const GameLayout: React.FC<GameLayoutProps> = ({ children, className }) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white overflow-hidden relative flex flex-col items-center justify-center p-4">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/20 blur-[100px]" />
      
      <div className={cn("relative z-10 w-full max-w-4xl", className)}>
        {children}
      </div>
    </div>
  );
};

export default GameLayout;
