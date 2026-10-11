// Generated from amalie-games/shared/monetization.ts. Run its sync-monetization script; do not edit.
/** Authoritative Playam eligibility policy. No SDK or ad delivery. */
export const WEB_ADS_ENABLED = false
export type ContentSource = 'curated' | 'ai-generated' | 'unknown'
export type MonetizationConfig = Readonly<{ adsAllowed: boolean; reason?: string }>
export const monetizationConfig = {
  playam: { adsAllowed: true },
  'stats-master': { adsAllowed: true },
  population: { adsAllowed: true },
  'football-bingo': { adsAllowed: true },
  ish: { adsAllowed: true },
  'real-vs-ai': { adsAllowed: true },
  anno: { adsAllowed: true },
  'lets-shop': { adsAllowed: true },
  nvwls: { adsAllowed: true },
  hitparade: { adsAllowed: false, reason: 'Permanently ad-free' },
  lesestigen: { adsAllowed: false, reason: 'Permanently ad-free' },
  tombola: { adsAllowed: false, reason: 'Excluded unless explicitly reviewed' },
} as const satisfies Record<string, MonetizationConfig>
export type MonetizableProduct = keyof typeof monetizationConfig
export type AdContext = {
  game: string
  route?: string
  gameMode?: string
  contentSource?: ContentSource
  phase?: 'landing' | 'content' | 'results' | 'active' | 'loading' | 'lobby'
}

/** Eligibility only. Delivery additionally requires approval, consent and WEB_ADS_ENABLED. */
export function canShowAds(context: AdContext): boolean {
  const { game, route, gameMode, contentSource, phase } = context
  if (!Object.prototype.hasOwnProperty.call(monetizationConfig, game)) return false
  if (!monetizationConfig[game as MonetizableProduct].adsAllowed) return false
  if (contentSource === 'ai-generated') return false
  if (game === 'ish' && (contentSource !== 'curated' || /(?:^|[-_\s])(?:custom|generated|ai)(?:$|[-_\s])/i.test(gameMode ?? ''))) return false
  if (phase && !['landing', 'content', 'results'].includes(phase)) return false
  if (route) {
    const path = route.split(/[?#]/)[0].toLowerCase()
    if (/(?:^|\/)(?:privacy|terms|api|admin|account|profile|sign-in|sign-up|login|join|lobby|setup|settings|loading|error|generate)(?:\/|$)/.test(path)) return false
    if (/^\/games\/(?:hitparade|lesestigen|tombola)(?:\/|$)/.test(path)) return false
    if (/(?:^|\/)(?:game|play|daily|solo|party)(?:\/|$)/.test(path) && phase !== 'results') return false
    if (game === 'playam' && !/^\/(?:blog(?:\/[^/]+)?|games\/[^/]+)\/?$/.test(path)) return false
  }
  return true
}

/** Only final results, never a question reveal or an active interaction. */
export function monetizationBreakReached(context: AdContext & { completed: boolean }): boolean {
  return context.completed && context.phase === 'results' && canShowAds(context)
}
