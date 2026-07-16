import { useUser } from '@clerk/react'
import { isAdFree, adFreeUntilDate, type AdFreePublicMetadata } from '@/lib/entitlement'

/**
 * Client hook for the ad-free entitlement. Reads Clerk publicMetadata.
 * Guests / signed-out users are never ad-free (they see ads → the upsell).
 * While Clerk is still hydrating, `isLoaded` is false — callers should render
 * nothing rather than flash an ad.
 */
export function useAdFree() {
  const { user, isLoaded } = useUser()
  const metadata = (user?.publicMetadata ?? null) as AdFreePublicMetadata | null

  return {
    isLoaded,
    isAdFree: isLoaded ? isAdFree(metadata) : false,
    adFreeUntil: adFreeUntilDate(metadata),
    plan: metadata?.adFreePlan ?? null,
    subscriptionActive: !!metadata?.subscriptionActive,
  }
}
