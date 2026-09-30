import posthog from 'posthog-js'

// Cookieless analytics, shared PostHog project for all our games. `game` keeps
// each game's numbers together whatever domain it's served from. /ingest is
// proxied to PostHog EU in vercel.json.
if (import.meta.env.PROD) {
  posthog.init('phc_tSpvObjeFadaIAJbGe03ryvbMnq43kepi5Gonp9dmbk', {
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-08-30',
    cookieless_mode: 'always',
    before_send: (event) => {
      if (event) event.properties.game = 'real-vs-ai'
      return event
    },
  })
}
