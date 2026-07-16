import React, { useEffect, useRef, useState } from 'react'
import { useUser, useAuth, SignInButton } from '@clerk/react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
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
  const { userId } = useAuth()
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

  // After returning from Checkout, the webhook writes the entitlement async —
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
    const email = user?.emailAddresses?.[0]?.emailAddress
    if (!userId || !email) return
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userEmail: email, plan }),
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
    const email = user?.emailAddresses?.[0]?.emailAddress
    setLoadingPlan('portal')
    try {
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userEmail: email }),
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
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8552]" />
        </div>
      </GameLayout>
    )
  }

  return (
    <GameLayout className="max-w-4xl">
      <div className="space-y-8 py-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FF8552]/15 px-4 py-1.5">
            <Sparkles className="w-4 h-4 text-[#FF8552]" />
            <span className="font-body font-semibold text-sm text-[#FF8552]">Go ad-free</span>
          </div>
          <h1 className="font-display font-extrabold text-[44px] leading-tight text-[#FFF8F0]">
            Play without the ads
          </h1>
          <p className="text-[#9AA3D0] max-w-md mx-auto">
            Pick a pass. Ads disappear instantly — and when you host, your whole room rides along.
          </p>
        </motion.div>

        {/* Ad-free banner */}
        {adFree && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] border border-[#57E6D2]/40 bg-[#57E6D2]/10 p-5 flex items-center justify-between flex-wrap gap-4"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-[#57E6D2]" />
              <div>
                <p className="font-display font-bold text-[#FFF8F0]">
                  You're ad-free
                  {metadata?.adFreePlan ? ` · ${metadata.adFreePlan} plan` : ''}
                </p>
                {until && (
                  <p className="font-body text-sm text-[#9AA3D0]">
                    {subscriptionActive ? 'Renews' : 'Until'}{' '}
                    {until.toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
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
              <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
                Back to game
              </Button>
            </div>
          </motion.div>
        )}

        {/* Polling notice */}
        {polling && !adFree && (
          <div className="rounded-[16px] bg-white/5 p-4 flex items-center justify-center gap-3 text-[#9AA3D0]">
            <Loader2 className="w-4 h-4 animate-spin text-[#FF8552]" />
            <span className="font-body text-sm">Confirming your purchase…</span>
          </div>
        )}

        {/* Tiers — hidden once ad-free unless a subscription might be upgraded */}
        {!adFree && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    'relative rounded-[24px] border bg-[#1F2450] p-6 flex flex-col gap-5',
                    tier.badge ? 'border-[#FF8552]/60' : 'border-white/[0.07]',
                  )}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#FF8552] text-[#151936] font-display font-extrabold text-xs px-3 py-1 whitespace-nowrap">
                      {tier.badge}
                    </div>
                  )}
                  <div>
                    <p className="font-body font-semibold text-sm text-[#9AA3D0]">{tier.name}</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="font-display font-extrabold text-4xl text-[#FFF8F0]">
                        {tier.price}
                      </span>
                      <span className="font-body text-sm text-[#6E77A8]">{tier.period}</span>
                    </div>
                    <p className="font-body text-sm text-[#9AA3D0] mt-1.5">{tier.blurb}</p>
                  </div>

                  {user ? (
                    <Button
                      className="w-full mt-auto"
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
                    <SignInButton mode="modal">
                      <Button
                        className="w-full mt-auto"
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
            <div className="rounded-[24px] border border-white/[0.07] bg-[#1F2450] p-6">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#57E6D2] shrink-0 mt-0.5" />
                    <span className="font-body text-sm text-[#C6CCF2]">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!user && (
              <p className="text-center font-body text-sm text-[#6E77A8]">
                Sign in required to purchase — it's how we tie the pass to your account.
              </p>
            )}
          </>
        )}
      </div>
    </GameLayout>
  )
}

export default GoAdFree
