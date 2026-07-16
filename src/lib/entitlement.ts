// Single source of truth for the ad-free entitlement.
//
// One timestamp lives on the Clerk user's publicMetadata.adFreeUntil. The day
// pass sets it to now+24h; subscriptions push it to the current period end on
// each renewal webhook. Ads are hidden whenever it's in the future — one gate
// covers both the one-time and recurring models.

export type AdFreePublicMetadata = {
  /** ISO 8601 timestamp until which the user is ad-free. */
  adFreeUntil?: string | null
  /** 'day' | 'month' | 'year' — the plan behind the current entitlement (for display). */
  adFreePlan?: 'day' | 'month' | 'year' | null
  /** Whether a recurring subscription is currently active (drives "Manage subscription"). */
  subscriptionActive?: boolean | null
}

/** Isomorphic — safe on both the client and the webhook (server). */
export function isAdFree(metadata: AdFreePublicMetadata | null | undefined): boolean {
  const until = metadata?.adFreeUntil
  if (!until) return false
  const ts = new Date(until).getTime()
  return Number.isFinite(ts) && ts > Date.now()
}

export function adFreeUntilDate(
  metadata: AdFreePublicMetadata | null | undefined,
): Date | null {
  const until = metadata?.adFreeUntil
  if (!until) return null
  const d = new Date(until)
  return Number.isFinite(d.getTime()) ? d : null
}
