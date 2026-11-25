import React, { useEffect, useRef, useState } from 'react'
import { useUser, useAuth, SignInButton } from '@clerk/react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import Seo from '@/components/Seo'
import { cn } from '@/lib/utils'
import { isAdFree, adFreeUntilDate, type AdFreePublicMetadata } from '@/lib/entitlement'
import { Check, Loader2, Sparkles, ShieldCheck } from 'lucide-react'

type Plan = 'day' | 'month' | 'year'

const TIERS: {
  id: Plan
  name: string
  price: string
  period: string
  blurb: string
  badge?: string
}[] = [
  { id: 'day', name: 'Day pass', price: '19 kr', period: 'one-time', blurb: '24 hours, ad-free' },
  { id: 'month', name: 'Monthly', price: '49 kr', period: '/month', blurb: 'Cancel anytime' },
  {
    id: 'year',
    name: 'Yearly',
    price: '299 kr',
    period: '/year',
    blurb: 'Six months free vs monthly',
    badge: 'Best value',
  },
]

const PERKS = [
  'No banner ads, anywhere',
  'No popunder ads',
  'Everyone in your game goes ad-free when you host',
  'Support the people making the game',
]

const GoAdFree: React.FC = () => {
  const { user, isLoaded } = useUser()
  const { userId, getToken } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loadingPlan, setLoadingPlan] = useState<Plan | 'portal' | null>(null)

  const status = searchParams.get('status')
  const [polling, setPolling] = useState(status === 'success')
  const pollRef = useRef(0)

  const metadata = (user?.publicMetadata ?? null) as AdFreePublicMetadata | null
  const adFree = isLoaded ? isAdFree(metadata) : false
  const until = adFreeUntilDate(metadata)
  const subscriptionActive = !!metadata?.subscriptionActive

  // After returning from Checkout, the webhook writes the entitlement async -
  // poll a few times so the page reflects it without a manual refresh.
  useEffect(() => {
    if (status !== 'success' || !user) return
    if (adFree) {
      setPolling(false)
      return
    }
    if (pollRef.current >= 6) {
      setPolling(false)
      return
    }
    const t = setTimeout(() => {
      pollRef.current += 1
      user.reload()
    }, 1500)
    return () => clearTimeout(t)
  }, [status, user, adFree, polling])

  const startCheckout = async (plan: Plan) => {
    if (!userId) return
    setLoadingPlan(plan)
    try {
      const token = await getToken()
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else {
        console.error(data)
        setLoadingPlan(null)
      }
    } catch (err) {
      console.error(err)
      setLoadingPlan(null)
    }
  }

  const manageSubscription = async () => {
    setLoadingPlan('portal')
    try {
      const token = await getToken()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setLoadingPlan(null)
    } catch (err) {
      console.error(err)
      setLoadingPlan(null)
    }
  }

  if (!isLoaded) {
    return (
      <GameLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-ink" strokeWidth={3} />
        </div>
      </GameLayout>
    )
  }

  return (
    <GameLayout className="max-w-4xl">
      <Seo
        title="Go Ad-Free - Real or AI"
        description="Remove ads and support Real or AI. Get an ad-free pass and enjoy uninterrupted rounds of spotting the fake."
        path="/go-ad-free"
      />
      <div className="space-y-8 py-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 bg-side-a text-ink px-3 py-1.5">
            <Sparkles className="w-4 h-4" strokeWidth={2.5} />
            <span className="type-label text-sm">Go ad-free</span>
          </div>
          <h1 className="type-display text-[40px] md:text-[56px] leading-[0.95]">
            Play without the ads.
          </h1>
          <p className="font-medium text-text-muted max-w-md mx-auto">
            Pick a pass. Ads disappear instantly - and when you host, your whole room rides along.
          </p>
        </motion.div>

        {/* Ad-free banner */}
        {adFree && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-side-a text-ink p-5 flex items-center justify-between flex-wrap gap-4"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 shrink-0" strokeWidth={2.5} />
              <div>
                <p className="type-display text-lg leading-tight">
                  You're ad-free
                  {metadata?.adFreePlan ? ` · ${metadata.adFreePlan} plan` : ''}
                </p>
                {until && (
                  <p className="font-medium text-sm">
                    {subscriptionActive ? 'Renews' : 'Until'}{' '}
                    {until.toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {subscriptionActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={manageSubscription}
                  disabled={loadingPlan === 'portal'}
                >
                  {loadingPlan === 'portal' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Manage subscription'
                  )}
                </Button>
              )}
              <Button variant="ink" size="sm" onClick={() => navigate('/')}>
                Back to game
              </Button>
            </div>
          </motion.div>
        )}

        {/* Polling notice */}
        {polling && !adFree && (
          <div className="border-4 border-ink p-4 flex items-center justify-center gap-3 text-ink">
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={3} />
            <span className="font-semibold text-sm">Confirming your purchase…</span>
          </div>
        )}

        {/* Tiers - hidden once ad-free unless a subscription might be upgraded */}
        {!adFree && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    'relative border-4 bg-paper p-6 flex flex-col gap-5',
                    tier.badge ? 'border-side-a' : 'border-ink',
                  )}
                >
                  {tier.badge && (
                    <div className="absolute -top-4 left-5 bg-side-a text-ink type-label text-xs px-3 py-1.5 whitespace-nowrap">
                      {tier.badge}
                    </div>
                  )}
                  <div>
                    <p className="type-label text-sm text-text-muted">{tier.name}</p>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="type-display text-4xl leading-none">{tier.price}</span>
                      <span className="type-label text-sm text-text-muted">{tier.period}</span>
                    </div>
                    <p className="font-medium text-sm text-text-muted mt-2">{tier.blurb}</p>
                  </div>

                  {user ? (
                    <Button
                      className="w-full mt-auto md:h-11 md:px-3 md:text-sm lg:h-14 lg:text-lg"
                      variant={tier.badge ? 'default' : 'secondary'}
                      onClick={() => startCheckout(tier.id)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === tier.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Get it'
                      )}
                    </Button>
                  ) : (
                    <SignInButton withSignUp mode="modal">
                      <Button
                        className="w-full mt-auto md:h-11 md:px-3 md:text-sm lg:h-14 lg:text-lg"
                        variant={tier.badge ? 'default' : 'secondary'}
                      >
                        Sign in to buy
                      </Button>
                    </SignInButton>
                  )}
                </div>
              ))}
            </div>

            {/* Perks */}
            <div className="border-4 border-ink p-6">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <Check className="w-5 h-5 text-ink shrink-0" strokeWidth={3} />
                    <span className="font-medium text-sm">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!user && (
              <p className="text-center font-medium text-sm text-text-muted">
                Sign in required to purchase - it's how we tie the pass to your account.
              </p>
            )}
          </>
        )}
      </div>
    </GameLayout>
  )
}

export default GoAdFree
