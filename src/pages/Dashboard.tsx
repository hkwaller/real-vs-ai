import React, { useState } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    color: 'from-indigo-400 to-purple-400',
    border: 'hover:border-indigo-500/50',
  },
  {
    id: 'yearly' as const,
    name: 'Pro Yearly',
    price: '$79',
    period: '/year',
    envKey: 'VITE_STRIPE_PRICE_ID_YEARLY',
    description: 'Save 27% compared to monthly',
    badge: 'Best Value',
    color: 'from-purple-400 to-pink-400',
    border: 'hover:border-purple-500/50 border-purple-500/30',
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
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
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
      alert('Stripe price ID not configured. Add VITE_STRIPE_PRICE_ID_MONTHLY / _YEARLY to your env.')
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

        {/* Success / Cancelled banner */}
        {successParam === 'true' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">Subscription activated — welcome to Pro! 🎉</span>
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
              <h1 className="text-2xl font-bold text-white">
                {user.firstName ? `Hey, ${user.firstName} 👋` : 'Dashboard'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
          <Button variant="neon" onClick={() => navigate('/create')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Game
          </Button>
        </motion.div>

        {/* Subscription status card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {isSubscribed ? (
            <Card className="border-indigo-500/40 bg-indigo-500/10">
              <CardContent className="flex items-center justify-between pt-6 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                      {planLabel}
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                        Active
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      Full access to all features
                    </div>
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
              </CardContent>
            </Card>
          ) : (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="flex items-center justify-between pt-6 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Free Plan</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      Ads shown on your host screen — upgrade to remove them
                    </div>
                  </div>
                </div>
                <Button
                  variant="neon"
                  size="sm"
                  onClick={() =>
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Game history */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Recent Games
              </CardTitle>
              <CardDescription>
                {gameHistory.length > 0
                  ? `Your last ${gameHistory.length} session${gameHistory.length > 1 ? 's' : ''} on this device`
                  : 'Games you host will appear here'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gameHistory.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 italic">
                  No games yet —{' '}
                  <button
                    className="underline text-indigo-400 underline-offset-4"
                    onClick={() => navigate('/create')}
                  >
                    create one!
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {gameHistory.map((game, i) => {
                    const winner = game.scores[0]
                    return (
                      <motion.div
                        key={game.gameId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 gap-4 flex-wrap"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded tracking-widest">
                            {game.gameId}
                          </span>
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(game.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        {winner && (
                          <div className="flex items-center gap-2 text-sm">
                            <span>🏆</span>
                            <span className="font-medium">
                              {winner.emoji} {winner.name}
                            </span>
                            <span className="font-mono text-indigo-300 font-bold">
                              {winner.score} pts
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-400" />
                    Daily Challenge History
                  </CardTitle>
                  <CardDescription>Your completed daily challenges</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {entries.map(([date, result]) => {
                      const pct = Math.round((result.score / result.maxScore) * 100)
                      return (
                        <Link key={date} to={`/daily/${date}`} className="block">
                          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-amber-500/30 transition-colors gap-4">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-20 bg-white/10 rounded-full h-1.5 hidden sm:block">
                                <div
                                  className="bg-gradient-to-r from-amber-400 to-orange-400 h-1.5 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-amber-400 font-bold text-sm">
                                {result.score}/{result.maxScore}
                              </span>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })()}

        {/* Pricing section (only when not subscribed) */}
        {!isSubscribed && (
          <motion.div
            id="pricing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6 pb-4"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Upgrade to Pro
              </h2>
              <p className="text-muted-foreground">
                Remove ads + unlock all features — 7-day free trial, no charge until it ends
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PLANS.map((plan) => (
                <Card
                  key={plan.id}
                  className={cn(
                    'relative overflow-hidden transition-colors',
                    plan.border,
                    plan.badge ? 'border-purple-500/30' : 'border-white/10',
                  )}
                >
                  {plan.badge && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {plan.badge}
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle
                      className={cn(
                        'text-xl bg-clip-text text-transparent bg-gradient-to-r',
                        plan.color,
                      )}
                    >
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline gap-1 pt-1">
                      <span className="text-5xl font-black text-white">{plan.price}</span>
                      <span className="text-muted-foreground text-lg">{plan.period}</span>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ul className="space-y-2.5">
                      {FEATURES.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="neon"
                      size="lg"
                      className="w-full"
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Start 7-Day Free Trial
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </GameLayout>
  )
}

export default Dashboard
