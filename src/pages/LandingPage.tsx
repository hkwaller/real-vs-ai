import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, Variants } from 'framer-motion'
import { useAuth, UserButton } from '@clerk/react'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { LayoutDashboard } from 'lucide-react'

interface GameRecord {
  players?: { name: string; score: number; emoji?: string }[]
}

interface LeaderEntry {
  rank: number
  name: string
  score: number
  emoji: string
}

function useLeaderboard(): LeaderEntry[] {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('real_vs_ai_history')
      if (!raw) return []
      const history: GameRecord[] = JSON.parse(raw)
      const totals: Record<string, number> = {}
      const emojis: Record<string, string> = {}
      for (const game of history) {
        for (const p of game.players ?? []) {
          totals[p.name] = (totals[p.name] ?? 0) + p.score
          if (p.emoji) emojis[p.name] = p.emoji
        }
      }
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, score], i) => ({
          rank: i + 1,
          name,
          score,
          emoji: emojis[name] ?? '🎮',
        }))
    } catch {
      return []
    }
  }, [])
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 90 } },
}

// Sample party used only when there's no local history yet, so the hero feels alive.
const SAMPLE_PARTY = [
  { name: 'Maya', emoji: '🦊' },
  { name: 'Jonas', emoji: '🤖' },
  { name: 'Priya', emoji: '🥱' },
]

const SAMPLE_PODIUM: LeaderEntry[] = [
  { rank: 1, name: 'Jonas', score: 840, emoji: '🤖' },
  { rank: 2, name: 'Maya', score: 720, emoji: '🦊' },
  { rank: 3, name: 'Priya', score: 610, emoji: '🥱' },
]

const Logo: React.FC = () => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-[12px] bg-[#FF8552] -rotate-6 flex items-center justify-center shadow-[0_4px_0_#C25327]">
      <span className="font-display font-extrabold text-[#151936] text-lg leading-none">R?</span>
    </div>
    <span className="font-display font-extrabold text-[#FFF8F0] text-lg">Real or AI</span>
  </div>
)

const PlayerChip: React.FC<{ emoji: string; name: string }> = ({ emoji, name }) => (
  <div className="flex items-center gap-2.5 rounded-[14px] bg-white/5 px-3 py-2.5">
    <span className="text-xl leading-none">{emoji}</span>
    <span className="font-display font-bold text-[#FFF8F0] text-sm truncate">{name}</span>
  </div>
)

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const leaderboard = useLeaderboard()

  const podium = leaderboard.length > 0 ? leaderboard : SAMPLE_PODIUM
  const winner = podium.find((p) => p.rank === 1)
  const byRank = (r: number) => podium.find((p) => p.rank === r)
  const podiumHeights: Record<number, number> = { 1: 84, 2: 60, 3: 44 }

  return (
    <GameLayout className="max-w-6xl">
      {/* Header */}
      {isLoaded && (
        <div className="flex items-center justify-between mb-10">
          <Logo />
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate('/dashboard')}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
                <UserButton />
              </>
            ) : (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate('/sign-in')}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      )}

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-8">
        {/* Hero */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center"
        >
          {/* Left: headline + CTAs */}
          <div>
            <h1 className="font-display font-extrabold text-5xl md:text-[72px] leading-[0.95] tracking-tight text-[#FFF8F0]">
              Spot the fake.
              <br />
              <span className="text-[#FF8552]">Beat your friends.</span>
            </h1>
            <p className="text-[#9AA3D0] text-lg mt-6 max-w-md">
              Two photos. One is real, one is AI. You've got 15 seconds — good luck.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-8">
              <Button size="lg" onClick={() => navigate('/create')}>
                Start a party 🎉
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate('/join')}>
                I have a code
              </Button>
            </div>
            <p className="text-[#6E77A8] text-sm mt-5">
              Free to play — no account needed for your first games
            </p>
          </div>

          {/* Right: Live party card */}
          <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display font-bold text-[#FFF8F0]">Live party</span>
              <span className="flex items-center gap-2 rounded-full bg-[#57E6D2]/15 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-[#57E6D2] animate-pulse" />
                <span className="font-body font-semibold text-xs text-[#57E6D2]">4 playing now</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SAMPLE_PARTY.map((p) => (
                <PlayerChip key={p.name} emoji={p.emoji} name={p.name} />
              ))}
              <div className="flex items-center gap-2.5 rounded-[14px] border border-dashed border-white/15 px-3 py-2.5 text-[#6E77A8]">
                <span className="text-xl leading-none">＋</span>
                <span className="font-display font-bold text-sm">You?</span>
              </div>
            </div>
            <div className="mt-3 rounded-[14px] bg-[#FFC94D]/12 px-3 py-2.5">
              <span className="font-body text-sm text-[#FFC94D]">🏆 Jonas is on a 5-round streak</span>
            </div>
          </div>
        </motion.div>

        {/* Daily challenge + Hall of fame */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DailyChallengeCard />

          {/* Hall of fame */}
          <div className="rounded-[24px] border border-white/[0.07] bg-[#1F2450] p-6">
            <h2 className="font-display font-bold text-[#FFF8F0] text-xl mb-5">Hall of fame</h2>
            <div className="flex items-end justify-center gap-3 h-[140px]">
              {[2, 1, 3].map((rank) => {
                const p = byRank(rank)
                const isWinner = rank === 1
                return (
                  <div key={rank} className="flex flex-col items-center gap-2 w-1/3">
                    <span className="text-2xl leading-none">{p?.emoji ?? '❓'}</span>
                    <div
                      className={`w-full rounded-t-[14px] flex flex-col items-center justify-start pt-3 ${
                        isWinner ? 'bg-[#FFC94D] text-[#151936]' : 'bg-white/5 text-[#9AA3D0]'
                      }`}
                      style={{ height: podiumHeights[rank] }}
                    >
                      <span className="font-display font-extrabold text-lg leading-none">{rank}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[#6E77A8] text-sm text-center mt-4">
              {winner
                ? `${winner.name} holds the crown with ${winner.score.toLocaleString()} pts`
                : 'Play a party to crown a champion'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </GameLayout>
  )
}

export default LandingPage
