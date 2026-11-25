import React, { useState } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { useAdFree } from '@/hooks/useAdFree'
import { getDailyScores } from '@/lib/dailyChallenge'
import { Crown, Zap, Trophy, Loader2, Plus, Calendar } from 'lucide-react'
import { ArrowRight } from '@/components/Brand'

type GameRecord = {
  date: string
  gameId: string
  scores: { id: string; name: string; emoji: string; score: number }[]
}

const Dashboard: React.FC = () => {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const { isAdFree, adFreeUntil, plan, subscriptionActive } = useAdFree()
  const navigate = useNavigate()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  if (!isLoaded) {
    return (
      <GameLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-ink" strokeWidth={3} />
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
      const token = await getToken()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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
          className="flex items-center justify-between flex-wrap gap-4 border-b-4 border-ink pb-6"
        >
          <div className="flex items-center gap-4 min-w-0">
            <UserButton />
            <div className="min-w-0">
              <p className="type-label text-xs text-text-muted mb-1">Signed in</p>
              <h1 className="type-display text-3xl leading-none truncate">
                {user.firstName ?? 'Dashboard'}
              </h1>
              <p className="font-medium text-sm text-text-muted mt-1 truncate">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/create')}>
            <Plus className="w-5 h-5" strokeWidth={3} />
            New game
          </Button>
        </motion.div>

        {/* Ad-free status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {isAdFree ? (
            <div className="border-4 border-ink p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-side-a text-ink flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="type-label text-xs text-text-muted mb-1">Status</p>
                  <div className="type-display text-lg leading-none flex items-center gap-3 flex-wrap">
                    {planLabel}
                    <span className="type-label text-xs bg-ink text-paper px-2 py-1">
                      Ad-free
                    </span>
                  </div>
                  <p className="font-medium text-sm text-text-muted mt-1">
                    {adFreeUntil
                      ? `${subscriptionActive ? 'Renews' : 'Until'} ${adFreeUntil.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                      : 'No ads across the game'}
                  </p>
                </div>
              </div>
              {subscriptionActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={loadingAction === 'portal'}
                >
                  {loadingAction === 'portal' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Manage billing'
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="border-4 border-ink p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border-4 border-ink flex items-center justify-center shrink-0">
                  <Zap className="w-6 h-6 text-ink" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="type-label text-xs text-text-muted mb-1">Status</p>
                  <div className="type-display text-lg leading-none">Free plan</div>
                  <p className="font-medium text-sm text-text-muted mt-1">No web advertising</p>
                </div>
              </div>

            </div>
          )}
        </motion.div>

        {/* Game history */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="border-4 border-ink p-6">
            <div className="flex items-center gap-3 mb-5">
              <Trophy className="w-6 h-6 text-ink" strokeWidth={2.5} />
              <div>
                <p className="type-label text-xs text-text-muted mb-1">Records</p>
                <h2 className="type-display text-2xl leading-none">Game history.</h2>
              </div>
            </div>

            {gameHistory.length === 0 ? (
              <div className="text-center py-10 space-y-3 border-t-2 border-ink">
                <p className="font-medium text-text-muted">No games recorded yet.</p>
                <Button variant="link" size="sm" onClick={() => navigate('/create')}>
                  Host your first game
                  <ArrowRight />
                </Button>
              </div>
            ) : (
              <div className="border-t-2 border-ink divide-y-2 divide-ink">
                {gameHistory.map((game, i) => {
                  const winner = game.scores?.[0]
                  return (
                    <motion.div
                      key={game.gameId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center justify-between py-3 gap-4 flex-wrap"
                    >
                      <div className="flex items-center gap-3">
                        <span className="type-label text-xs bg-ink text-paper px-2 py-1 tracking-widest">
                          {game.gameId}
                        </span>
                        <span className="flex items-center gap-1.5 type-label text-xs text-text-muted">
                          <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
                          {new Date(game.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      {winner && (
                        <div className="flex items-center gap-2">
                          <span className="type-label text-xs text-text-muted">Winner</span>
                          <span className="type-name text-sm">{winner.name}</span>
                          <span className="type-label text-xs">{winner.score} PTS</span>
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
              <div className="border-4 border-ink p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Calendar className="w-6 h-6 text-ink" strokeWidth={2.5} />
                  <div>
                    <p className="type-label text-xs text-text-muted mb-1">Daily</p>
                    <h2 className="type-display text-2xl leading-none">Challenge history.</h2>
                  </div>
                </div>
                <div className="border-t-2 border-ink divide-y-2 divide-ink">
                  {entries.map(([date, result]) => {
                    const pct = Math.round((result.score / result.maxScore) * 100)
                    return (
                      <Link key={date} to={`/daily/${date}`} className="block group">
                        <div className="flex items-center justify-between py-3 gap-4">
                          <span className="flex items-center gap-1.5 type-label text-xs text-text-muted group-hover:text-side-b transition-colors">
                            <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
                            {new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-20 bg-muted h-2 hidden sm:block">
                              <div
                                className="bg-side-a h-2 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="type-label text-xs tabular-nums">
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


      </div>
    </GameLayout>
  )
}

export default Dashboard
