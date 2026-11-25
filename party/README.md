# Real or AI realtime rooms

Multiplayer runs on PartyServer on Cloudflare Workers, the same setup as our other games: one hibernating SQLite Durable Object per party code. The room rules live in `src/lib/partyRoom.ts` and are shared by the Worker and the browser. The Worker validates and applies every action, computes scores from its own clock, saves the room and broadcasts it to every socket. Rooms are wiped after 24 hours without an accepted action.

## How a device gets in

- Each device keeps a secret guest key in localStorage. The host screen has one (`rvai_host_key`), and each join creates a new one, stored with the player's name under `rvai_player_<pid>`.
- Before every (re)connect, the client posts `{ room, key }` to `/api/party-auth` (`api/party-auth.js`). The route returns a one-hour HMAC ticket for `g_<hash of key>`.
- The Worker checks the ticket (`party/roomTicket.js`) before the socket reaches the room. Nobody needs an account.
- The screen that opens the lobby becomes `hostId`. While that screen is online, another screen gets "This code is already in a game". Once it goes offline, a new screen that opens the code starts a clean room.

## Local development

1. Generate a secret with `openssl rand -hex 32`. Put the same `PARTY_SECRET` in `.env.local` and `party/.dev.vars`. Git ignores both files.
2. Set `VITE_PARTY_HOST=localhost:1999` in `.env.local`.
3. Run `npm run party:dev` (Worker on port 1999) and `npm run dev` in separate terminals. In dev, Vite serves `/api/party-auth` itself (see `partyAuthDev` in `vite.config.js`). `npm run dev:api` (`vercel dev`) works too.
4. Open the lobby in one tab and join from another. Play a full game, reload both mid-round, try the boss controls and the kick.

## Validation

```sh
npm run typecheck
npm run party:check
npm run build
npx wrangler deploy --dry-run --config party/wrangler.jsonc --outdir /tmp/real-vs-ai-party-bundle
```

## Deployment

1. Deploy the Worker with `npm run party:deploy` on the Playam Cloudflare account. It is named `real-vs-ai-party`.
2. Run `npx wrangler secret put PARTY_SECRET --config party/wrangler.jsonc` and enter a new secret.
3. In Vercel, set `PARTY_SECRET` (the same value) and `VITE_PARTY_HOST=real-vs-ai-party.playam.workers.dev`.
4. `vercel.json` runs `npm run vercel-build`. On production builds that script checks the Worker types, builds the site and runs `party:deploy`. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in Vercel's Production environment, and fails the build if they are missing. Preview and local builds never deploy the Worker.

The Worker goes live before Vercel publishes the frontend, so keep Worker changes compatible with clients and rooms that are already running. A Vercel rollback does not roll back Cloudflare.
