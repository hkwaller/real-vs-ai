import React, { useState } from 'react'
import { useUser, UserButton } from '@clerk/react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { useAdFree } from '@/hooks/useAdFree'
import { getDailyScores } from '@/lib/dailyChallenge'
import { Crown, Zap, Trophy, Loader2, Plus, Calendar } from 'lucide-react'

type GameRecord = {
  date: string
  gameId: string
  scores: { id: string; name: string; emoji: string; score: number }[]
}

const Dashboard: React.FC = () => {
  const { user, isLoaded } = useUser()
  const { isAdFree, adFreeUntil, plan, subscriptionActive } = useAdFree()
  const navigate = useNavigate()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  if (!isLoaded) {
    return (
      <GameLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B1A]" />
        </div>
      </GameLayout>
    )
  }

  if (!user) return null

  const planLabel = plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)} pass` : 'Ad-free'

  const gameHistory: GameRecord[] = (
    JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]') as GameRecord[]
  )
    .reverse()
    .slice(0, 10)

  const handleManageBilling = async () => {
    setLoadingAction('portal')
    try {
      const email = user.emailAddresses[0]?.emailAddress
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: email }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <GameLayout className="max-w-4xl">
      <div className="space-y-8 py-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-4">
            <UserButton />
            <div>
              <p className="mission-label mb-0.5">Operative</p>
              <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
                {user.firstName ?? 'Dashboard'}
              </h1>
              <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/create')}>
            <Plus className="w-4 h-4 mr-2" />
            New Mission
          </Button>
        </motion.div>

        {/* Ad-free status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {isAdFree ? (
            <div className="corner-bracket bg-[#111840] border border-[#FF6B1A]/40 p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border border-[#FF6B1A] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-[#FF6B1A]" />
                </div>
                <div>
                  <p className="mission-label mb-0.5">Status</p>
                  <div className="font-orbitron font-bold text-[#F5F0E8] flex items-center gap-3">
                    {planLabel}
                    <span className="font-space-mono text-xs bg-[#FF6B1A]/20 text-[#FF6B1A] px-2 py-0.5 border border-[#FF6B1A]/40">
                      AD-FREE
                    </span>
                  </div>
                  <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">
                    {adFreeUntil
                      ? `${subscriptionActive ? 'Renews' : 'Until'} ${adFreeUntil.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                      : 'No ads across the game'}
                  </p>
                </div>
              </div>
              {subscriptionActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={loadingAction === 'portal'}
                >
                  {loadingAction === 'portal' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Manage Billing'
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="corner-bracket bg-[#111840] border border-[#FFB830]/40 p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border border-[#FFB830] flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[#FFB830]" />
                </div>
                <div>
                  <p className="mission-label mb-0.5">Status</p>
                  <div className="font-orbitron font-bold text-[#F5F0E8]">Free Plan</div>
                  <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">Ads shown during games</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/go-ad-free')}>
                Go ad-free
              </Button>
            </div>
          )}
        </motion.div>

        {/* Game history */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-5 h-5 text-[#FFB830]" />
              <div>
                <p className="mission-label mb-0.5">Records</p>
                <h2 className="font-orbitron text-lg font-bold text-[#F5F0E8] uppercase tracking-wide">
                  Mission History
                </h2>
              </div>
            </div>

            {gameHistory.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="font-space-mono text-xs text-[#8B97C8]">// No missions recorded yet</p>
                <button
                  className="font-orbitron text-xs text-[#FF6B1A] uppercase tracking-widest hover:text-[#FF8C42] transition-colors"
                  onClick={() => navigate('/create')}
                >
                  Launch First Mission →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {gameHistory.map((game, i) => {
                  const winner = game.scores?.[0]
                  return (
                    <motion.div
                      key={game.gameId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between p-3 bg-[#1A2355] border border-[#2A3468] gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-space-mono text-xs text-[#FF6B1A] bg-[#FF6B1A]/10 px-2 py-1 border border-[#FF6B1A]/30 tracking-widest">
                          {game.gameId}
                        </span>
                        <span className="flex items-center gap-1.5 font-space-mono text-xs text-[#8B97C8]">
                          <Calendar className="w-3 h-3" />
                          {new Date(game.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {winner && (
                        <div className="flex items-center gap-2">
                          <span>🏆</span>
                          <span className="font-orbitron text-xs font-bold text-[#F5F0E8]">
                            {winner.emoji} {winner.name}
                          </span>
                          <span className="font-space-mono text-xs text-[#FFB830] font-bold">
                            {winner.score} PTS
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Daily Challenge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <DailyChallengeCard />
        </motion.div>

        {/* Daily Challenge History */}
        {(() => {
          const dailyScores = getDailyScores()
          const entries = Object.entries(dailyScores)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 10)
          if (entries.length === 0) return null
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="w-5 h-5 text-[#FFB830]" />
                  <div>
                    <p className="mission-label mb-0.5">Daily Ops</p>
                    <h2 className="font-orbitron text-lg font-bold text-[#F5F0E8] uppercase tracking-wide">
                      Challenge History
                    </h2>
                  </div>
                </div>
                <div className="space-y-2">
                  {entries.map(([date, result]) => {
                    const pct = Math.round((result.score / result.maxScore) * 100)
                    return (
                      <Link key={date} to={`/daily/${date}`} className="block">
                        <div className="flex items-center justify-between p-3 bg-[#1A2355] border border-[#2A3468] hover:border-[#FFB830]/40 transition-colors gap-4">
                          <span className="flex items-center gap-1.5 font-space-mono text-xs text-[#8B97C8]">
                            <Calendar className="w-3 h-3" />
                            {new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-[#2A3468] h-1.5 hidden sm:block">
                              <div
                                className="bg-[#FFB830] h-1.5 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-space-mono text-xs text-[#FFB830] font-bold">
                              {result.score}/{result.maxScore}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )
        })()}

        {/* Go ad-free CTA */}
        {!isAdFree && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="corner-bracket bg-[#111840] border border-[#FF6B1A]/40 p-6 flex items-center justify-between flex-wrap gap-4 pb-4"
          >
            <div>
              <p className="mission-label mb-1">Upgrade</p>
              <h2 className="font-orbitron text-2xl font-black text-[#FF6B1A] uppercase text-glow-orange">
                Go ad-free
              </h2>
              <p className="text-[#8B97C8] text-sm mt-1">
                Day pass from 19 kr, or subscribe. Hosts make the whole room ad-free.
              </p>
            </div>
            <Button size="lg" onClick={() => navigate('/go-ad-free')}>
              <Zap className="w-4 h-4 mr-2" />
              See options
            </Button>
          </motion.div>
        )}
      </div>
    </GameLayout>
  )
}

export default Dashboard
