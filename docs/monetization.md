# Monetization: ads + remove-ads

Adsterra ads for free players, plus a Stripe "ad-free" upsell (day pass +
monthly + yearly). Built with the `game-monetization` skill.

## Model

- Guests / signed-out users see ads. **Sign-in (Clerk) is required to buy.**
- Entitlement is one timestamp on the Clerk user: `publicMetadata.adFreeUntil`
  (ISO). The day pass sets `now + 24h` (stacking onto remaining time);
  subscriptions push it to the current period end on each renewal webhook. Ads
  are hidden whenever `adFreeUntil` is in the future — one gate, both models.
  See `src/lib/entitlement.ts` (`isAdFree`).
- `publicMetadata.adFreePlan` (`day`/`month`/`year`) and
  `publicMetadata.subscriptionActive` are for display + the "Manage subscription"
  button. The Stripe customer id is cached in `privateMetadata.stripeCustomerId`.
- **Host perk:** when the host starts a game ad-free, `hostAdFree` is stamped
  into Liveblocks room storage (`Lobby` start mutation) so the whole room is
  ad-free. Reset on rematch (`GameHost` resetGame). See
  `src/hooks/useInGameAdsSuppressed.ts`.

## Stripe account

Two accounts exist under the same name:

- **`acct_1TDR9BATHq798cmh` — "real-vs-ai sandbox" (TEST).** This is where the
  `sk_test` key + the dev `stripe listen` webhook point. All objects below live
  here. The MCP is *not* connected to this account — manage it with the
  `sk_test` key via curl / Stripe CLI.
- `acct_1TDR94PFt2ZmGnhj` — "real-vs-ai" (the account the Stripe MCP is on).
  Currently empty. Create the live-mode product + prices here when going to prod.

### Prices (test/sandbox)

Product `prod_UtiVfMXyvhsoqn` — "Real vs AI Ad-Free":

| Plan  | Price ID                          | Amount      | Type            | metadata                     |
| ----- | --------------------------------- | ----------- | --------------- | ---------------------------- |
| day   | `price_1Ttv4iATHq798cmhK3B5NDAw`  | 19 kr (NOK) | one-time        | `plan=day`, `grant_hours=24` |
| month | `price_1Ttv5CATHq798cmhqeMNTzWY`  | 49 kr/mo    | recurring month | `plan=month`                 |
| year  | `price_1Ttv5WATHq798cmhUbOcoJ9f`  | 299 kr/yr   | recurring year  | `plan=year`                  |

No free trial. lookup_keys: `rvai_adfree_day` / `_month` / `_year`.

Old misconfigured Monthly/Yearly products (`prod_UBopiPOIDlOAWF`,
`prod_UBopCY9uQV2jcL`) were archived.

## Code map

- `src/lib/entitlement.ts` — `isAdFree()` + types (isomorphic).
- `src/hooks/useAdFree.ts` — client entitlement from Clerk publicMetadata.
- `src/hooks/useInGameAdsSuppressed.ts` — `localAdFree || hostAdFree`.
- `src/components/AdsterraBanner.tsx` / `AdsterraPopunder.tsx` — self-gating ads.
- `src/pages/GoAdFree.tsx` (`/go-ad-free`) — pricing page, success polling, portal.
- `api/create-checkout-session.js` — plan→price/mode, caches customer, sets metadata.
- `api/create-portal-session.js` — Customer Portal (customer from Clerk, email fallback).
- `api/webhooks/stripe.js` — writes `adFreeUntil` (Node runtime, raw body).

### Ad placement

- Banner: Dashboard CTA, GameHost between-rounds reveal + results screens,
  PlayerGame waiting + game-over screens. **Never on active answering screens.**
- Popunder: PlayerGame game-over screen only (player devices, not the shared host display).

## Webhook

Events: `checkout.session.completed` (day pass, `mode==='payment'`),
`customer.subscription.created|updated|deleted`.

- Dev: `stripe listen --forward-to localhost:5173/api/webhooks/stripe`, paste the
  printed `whsec_` into `STRIPE_WEBHOOK_SECRET`, restart the dev server.
- Prod: custom domain is `www.real-vs-ai.buzz`. Endpoint (test mode)
  `we_1TDREfATHq798cmhmnwGhyjW` → `https://www.real-vs-ai.buzz/api/webhooks/stripe`,
  subscribed to all four events above. Its signing secret lives in the Vercel
  `STRIPE_WEBHOOK_SECRET` (Production). Set `APP_URL=https://www.real-vs-ai.buzz`
  in Vercel so Checkout return URLs use the custom domain, not the vercel.app alias.

## Test (card 4242 4242 4242 4242, any future expiry/CVC)

1. Sign in → buy day pass → ads vanish; `/go-ad-free` shows "day pass … until <time>".
2. Buy monthly → ad-free + "Manage subscription" opens the portal.
3. Cancel in portal → stays ad-free to period end, then ads return.
4. Guest/signed-out → always sees ads.
5. Ad-free host starts a game → joined players see no in-game ads.
