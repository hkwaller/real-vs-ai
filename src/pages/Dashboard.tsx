import React, { useState } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { cn } from '@/lib/utils'
import { getDailyScores } from '@/lib/dailyChallenge'
import {
  Crown,
  Zap,
  Trophy,
  Check,
  Loader2,
  Plus,
  Calendar,
  CheckCircle,
  Rocket,
} from 'lucide-react'

type GameRecord = {
  date: string
  gameId: string
  scores: { id: string; name: string; emoji: string; score: number }[]
}

type SubscriptionMetadata = {
  subscriptionStatus?: string
  subscriptionPlan?: 'monthly' | 'yearly' | 'pro'
  stripeSubscriptionId?: string
}

const FEATURES = [
  'No ads on your host screen',
  'Unlimited game sessions',
  'Full game history & stats',
  'Instant & after-round reveal modes',
  'Custom round & time settings',
]

const PLANS = [
  {
    id: 'monthly' as const,
    name: 'Pro Monthly',
    price: '$9',
    period: '/month',
    envKey: 'VITE_STRIPE_PRICE_ID_MONTHLY',
    description: 'Billed monthly, cancel anytime',
  },
  {
    id: 'yearly' as const,
    name: 'Pro Yearly',
    price: '$79',
    period: '/year',
    envKey: 'VITE_STRIPE_PRICE_ID_YEARLY',
    description: 'Save 27% compared to monthly',
    badge: 'Best Value',
  },
]

const Dashboard: React.FC = () => {
  const { user, isLoaded } = useUser()
  const { userId } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const successParam = searchParams.get('success')

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

  const metadata = (user.publicMetadata ?? {}) as SubscriptionMetadata
  const isSubscribed = metadata.subscriptionStatus === 'active'
  const planLabel =
    metadata.subscriptionPlan === 'monthly'
      ? 'Pro Monthly'
      : metadata.subscriptionPlan === 'yearly'
        ? 'Pro Yearly'
        : 'Pro'

  const gameHistory: GameRecord[] = (
    JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]') as GameRecord[]
  )
    .reverse()
    .slice(0, 10)

  const handleSubscribe = async (planId: 'monthly' | 'yearly') => {
    const priceId =
      planId === 'monthly'
        ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY
        : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY

    if (!priceId) {
      alert('Stripe price ID not configured.')
      return
    }

    setLoadingAction(planId)
    try {
      const email = user.emailAddresses[0]?.emailAddress
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userEmail: email, priceId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleManageBilling = async () => {
    setLoadingAction('portal')
    try {
      const email = user.emailAddresses[0]?.emailAddress
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email }),
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

        {/* Success banner */}
        {successParam === 'true' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 border border-[#00FFE5]/40 bg-[#00FFE5]/10 text-[#00FFE5]"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-orbitron text-sm font-bold uppercase tracking-widest">
              Subscription Activated — Welcome to Pro
            </span>
          </motion.div>
        )}

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

        {/* Subscription status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {isSubscribed ? (
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
                      ACTIVE
                    </span>
                  </div>
                  <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">Full access to all features</p>
                </div>
              </div>
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
                  <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">Ads shown on host screen</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Upgrade to Pro
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

        {/* Pricing */}
        {!isSubscribed && (
          <motion.div
            id="pricing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6 pb-4"
          >
            <div className="text-center space-y-2">
              <p className="mission-label">Upgrade</p>
              <h2 className="font-orbitron text-3xl font-black text-[#FF6B1A] uppercase text-glow-orange">
                Go Pro
              </h2>
              <p className="text-[#8B97C8] text-sm">
                Remove ads + unlock all features — 7-day free trial
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    'corner-bracket bg-[#111840] border p-6 space-y-6 relative',
                    plan.badge ? 'border-[#FF6B1A]/50' : 'border-[#2A3468]',
                  )}
                >
                  {plan.badge && (
                    <div className="absolute top-4 right-4 font-orbitron text-xs font-bold bg-[#FF6B1A] text-[#0B0F2E] px-2 py-1 uppercase tracking-widest">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <p className="mission-label mb-1">{plan.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-space-mono text-5xl font-bold text-[#F5F0E8]">
                        {plan.price}
                      </span>
                      <span className="text-[#8B97C8]">{plan.period}</span>
                    </div>
                    <p className="font-space-mono text-xs text-[#8B97C8] mt-1">// {plan.description}</p>
                  </div>

                  <ul className="space-y-2">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 font-space-mono text-xs text-[#8B97C8]">
                        <Check className="w-3.5 h-3.5 text-[#00FFE5] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loadingAction !== null}
                  >
                    {loadingAction === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Rocket className="w-4 h-4 mr-2" />
                    )}
                    Start 7-Day Free Trial
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </GameLayout>
  )
}

export default Dashboard
