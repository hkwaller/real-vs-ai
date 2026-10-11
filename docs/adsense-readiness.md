# Real vs AI readiness

Public root, privacy and terms have static HTML built from `public-pages.mjs`. SPA legal pages use the same text. Static shells use createRoot on mount (not hydration of different interactive markup). Canonical origin is realvsai.playam.app.

Adsterra components and loaders are removed. No web ad SDK is present. Shared eligibility is generated into src/lib/playam-monetization.ts. A future opportunity is only after a completed DailyChallenge or a finished GameHost/PlayerGame session, with final results visible. Never during the timer or between a guess and reveal.

Deployment and repeat crawler checks remain required.

Completion implementation references:
- `src/pages/DailyChallenge.tsx`
- `src/pages/PlayerGame.tsx`
