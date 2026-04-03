import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, Variants } from 'framer-motion'
import { useAuth, UserButton } from '@clerk/react'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { LayoutDashboard, Rocket, Users, Trophy } from 'lucide-react'

interface GameRecord {
  players?: { name: string; score: number }[]
}

function useLeaderboard() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('real_vs_ai_history')
      if (!raw) return []
      const history: GameRecord[] = JSON.parse(raw)
      const totals: Record<string, number> = {}
      for (const game of history) {
        const players = game.players ?? []
        for (const p of players) {
          totals[p.name] = (totals[p.name] ?? 0) + p.score
        }
      }
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, score], i) => ({ rank: i + 1, name, score }))
    } catch {
      return []
    }
  }, [])
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
}

const itemVariants: Variants = {
  hidden: { y: 24, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 90 } },
}

const rankColors = ['#FFB830', '#8B97C8', '#FF6B1A']

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const leaderboard = useLeaderboard()

  return (
    <GameLayout>
      {/* Nav */}
      {isLoaded && (
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00FFE5] animate-pulse" />
            <span className="font-orbitron text-xs font-bold tracking-[0.2em] text-[#8B97C8] uppercase">
              Real vs AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <UserButton />
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/sign-in')}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-10"
      >
        {/* Hero */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <h1 className="font-orbitron text-6xl md:text-8xl font-black uppercase tracking-tight text-[#FF6B1A] text-glow-orange">
            Real vs AI
          </h1>
          <p className="text-[#8B97C8] text-lg md:text-xl max-w-xl mx-auto tracking-wide">
            Can you tell the difference? <br className="hidden md:block" />
            Challenge your operatives in the ultimate Turing Test.
          </p>
        </motion.div>

        {/* Main grid: Multiplayer + Daily Challenge */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Multiplayer Mission card */}
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6 space-y-5">
            <div>
              <p className="mission-label mb-2">Multiplayer</p>
              <h2 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase tracking-wide">
                Mission Briefing
              </h2>
              <p className="text-[#8B97C8] text-sm mt-2">
                Host a live game and battle your friends in real time.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FFE5] animate-pulse" />
              <span className="font-space-mono text-xs text-[#00FFE5]">LIVE MULTIPLAYER ACTIVE</span>
            </div>

            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => navigate('/create')}>
                <Rocket className="w-4 h-4 mr-2" />
                Launch Mission
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/join')}>
                <Users className="w-4 h-4 mr-2" />
                Join Mission
              </Button>
            </div>

            <p className="font-space-mono text-xs text-[#8B97C8]">
              // First 3 missions free — no account needed
            </p>
          </div>

          {/* Daily Challenge */}
          <DailyChallengeCard />
        </motion.div>

        {/* Leaderboard */}
        <motion.div variants={itemVariants}>
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="mission-label mb-1">Rankings</p>
                <h2 className="font-orbitron text-xl font-bold text-[#F5F0E8] uppercase tracking-wide">
                  All-Time Operatives
                </h2>
              </div>
              <Trophy className="w-6 h-6 text-[#FFB830]" />
            </div>

            {leaderboard.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-[#2A3468] last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-space-mono text-sm w-6 text-[#2A3468]">
                        #{String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="h-2 w-24 bg-[#2A3468] rounded-sm" />
                    </div>
                    <span className="font-space-mono text-sm text-[#2A3468]">———</span>
                  </div>
                ))}
                <p className="font-space-mono text-xs text-[#8B97C8] mt-4 text-center">
                  // Play games to populate the leaderboard
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between py-3 border-b border-[#2A3468] last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className="font-space-mono text-sm w-6 font-bold"
                        style={{ color: rankColors[entry.rank - 1] ?? '#8B97C8' }}
                      >
                        #{String(entry.rank).padStart(2, '0')}
                      </span>
                      <span className="text-[#F5F0E8] text-sm">{entry.name}</span>
                    </div>
                    <span className="font-space-mono text-sm text-[#FFB830] font-bold">
                      {entry.score.toLocaleString()} PTS
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </GameLayout>
  )
}

export default LandingPage
