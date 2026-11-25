import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, UserButton } from '@clerk/react'
import Seo from '@/components/Seo'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { ArrowRight, Wordmark } from '@/components/Brand'
import { fetchSchedule, getImageUrls, getTodayDate } from '@/lib/dailyChallenge'

interface GameRecord {
  players?: { name: string; score: number }[]
}

interface LeaderEntry {
  rank: number
  name: string
  score: number
}

function useLeaderboard(): LeaderEntry[] {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem('real_vs_ai_history')
      if (!raw) return []
      const history: GameRecord[] = JSON.parse(raw)
      const totals: Record<string, number> = {}
      for (const game of history) {
        for (const p of game.players ?? []) {
          totals[p.name] = (totals[p.name] ?? 0) + p.score
        }
      }
      return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, score], i) => ({ rank: i + 1, name, score }))
    } catch {
      return []
    }
  }, [])
}

// A real pair from a past daily challenge for the hero (never today's, so nothing is spoiled).
function useHeroPair(): { a: string; b: string } | null {
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchSchedule()
      .then((schedule) => {
        if (!schedule || cancelled) return
        const today = getTodayDate()
        const past = Object.keys(schedule)
          .filter((d) => d < today && schedule[d]?.images?.length)
          .sort()
        const date = past[past.length - 1]
        const file = date ? schedule[date].images[0] : undefined
        if (!file) return
        const { realUrl, aiUrl } = getImageUrls(file)
        setPair({ a: realUrl, b: aiUrl })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return pair
}

const linkCls = 'type-label text-base py-3 underline-offset-4 hover:underline'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const leaderboard = useLeaderboard()
  const champion = leaderboard[0]
  const heroPair = useHeroPair()

  return (
    <div className="bg-paper text-ink overflow-x-hidden">
      <Seo title="Real or AI - Spot the fake. Beat your friends." path="/" />

      {/* Hero: the game itself, A against B */}
      <header className="grid grid-cols-1 md:grid-cols-2">
        <div className="bg-side-a text-ink px-4 md:px-14 pt-7 pb-10 flex flex-col gap-8">
          <nav className="flex items-center justify-between gap-4">
            <a href="/" className="py-3" aria-label="Real or AI home">
              <Wordmark />
            </a>
            <a href="#daily" className={`${linkCls} whitespace-nowrap`}>
              Daily challenge
            </a>
          </nav>
          <h1 className="type-display text-[clamp(64px,9vw,150px)] leading-[0.84] tracking-[-0.04em]">
            Spot
            <br />
            the<span className="md:sr-only"> fake.</span>
          </h1>
          <div className="aspect-[4/3] w-full max-w-[min(100%,46vh)] md:self-end bg-side-a-tint">
            {heroPair && (
              <img src={heroPair.a} alt="Photo A" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex justify-between items-end gap-4">
            <div className="flex flex-col gap-2 flex-1 md:flex-none min-w-0">
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="h-14 md:h-[72px] px-4 md:px-7 bg-ink text-paper type-display text-lg md:text-[26px] whitespace-nowrap inline-flex items-center justify-between md:justify-start gap-3 hover:brightness-[1.3] transition-[filter]"
              >
                Start a party <ArrowRight />
              </button>
              <button
                type="button"
                onClick={() => navigate('/join')}
                className="md:hidden h-14 px-4 border-4 border-ink text-ink type-display text-lg whitespace-nowrap text-left hover:bg-ink hover:text-paper transition-colors"
              >
                I have a code
              </button>
            </div>
            <span className="type-display text-[clamp(80px,8vw,120px)] leading-[0.75]" aria-hidden="true">
              A
            </span>
          </div>
        </div>
        <div className="bg-side-b text-paper on-dark px-4 md:px-14 pt-7 pb-10 flex flex-col gap-8">
          <nav className="flex items-center justify-end gap-6 min-h-12">
            {isLoaded &&
              (isSignedIn ? (
                <>
                  <button type="button" onClick={() => navigate('/dashboard')} className={linkCls}>
                    Dashboard
                  </button>
                  <UserButton />
                </>
              ) : (
                <button type="button" onClick={() => navigate('/sign-in')} className={linkCls}>
                  Sign in
                </button>
              ))}
          </nav>
          <span
            className="hidden md:block type-display text-[clamp(64px,9vw,150px)] leading-[0.84] tracking-[-0.04em]"
            aria-hidden="true"
          >
            Fake.
            <br />
            <span className="invisible">.</span>
          </span>
          <div className="aspect-[4/3] w-full max-w-[min(100%,46vh)] md:self-start bg-side-b-tint">
            {heroPair && (
              <img src={heroPair.b} alt="Photo B" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex justify-between items-end gap-4">
            <span className="type-display text-[clamp(80px,8vw,120px)] leading-[0.75]" aria-hidden="true">
              B
            </span>
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="hidden md:inline-flex items-center h-[72px] px-7 border-4 border-paper text-paper type-display text-[26px] hover:bg-paper hover:text-side-b transition-colors"
            >
              I have a code
            </button>
          </div>
        </div>
      </header>

      {/* Ink band: how it plays (the actions live in the hero) */}
      <section className="bg-ink text-paper on-dark">
        <div className="max-w-[1280px] mx-auto px-4 md:px-14 py-12 md:py-16 flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <p className="max-w-[36ch] font-semibold text-[clamp(20px,2vw,26px)] leading-[1.4]">
            Two photos on the TV. One is real, one is AI. Everyone votes from their phone, and
            faster right answers score more.
          </p>
          <span className="type-label text-[15px] text-on-ink-muted">
            Free to play · No account for your first games
          </span>
        </div>
      </section>

      {/* Daily challenge and hall of fame */}
      <section id="daily" className="grid grid-cols-1 md:grid-cols-2">
        <DailyChallengeCard />
        <article className="bg-paper text-ink px-4 md:px-14 py-12 md:py-[72px] flex flex-col gap-[22px]">
          <span className="type-label text-base">Hall of fame · This device</span>
          <h2 className="type-display text-[clamp(48px,5vw,80px)] leading-[0.88] break-words">
            {champion ? `${champion.name} rules.` : 'No champion yet.'}
          </h2>
          <p className="font-medium text-[19px] leading-[1.45] text-text-muted max-w-[34ch]">
            {champion
              ? 'Total points across every party hosted on this screen.'
              : 'Host a party on this screen and the top three land here, until someone beats them.'}
          </p>
          <ol className="flex flex-col mt-2.5">
            {[1, 2, 3].map((rank) => {
              const p = leaderboard.find((e) => e.rank === rank)
              return (
                <li
                  key={rank}
                  className={`flex items-baseline gap-[18px] py-3 border-t-2 border-ink ${rank === 1 ? 'border-t-4' : ''} ${rank === 3 ? 'border-b-2' : ''}`}
                >
                  <span className="type-display text-[32px] w-10">{rank}</span>
                  {p ? (
                    <>
                      <span className="type-name text-2xl truncate">{p.name}</span>
                      <span className="ml-auto type-label text-base tabular-nums">
                        {p.score.toLocaleString()} pts
                      </span>
                    </>
                  ) : (
                    <span className="type-label text-[17px] text-text-placeholder">Open</span>
                  )}
                </li>
              )
            })}
          </ol>
        </article>
      </section>

      <footer className="bg-ink text-paper on-dark">
        <div className="max-w-[1280px] mx-auto px-4 md:px-14 pt-7 pb-9 flex flex-wrap items-center justify-between gap-4">
          <Wordmark className="text-xl" />
          <div className="flex flex-wrap gap-6">
            <a href="/privacy" className={linkCls}>
              Privacy
            </a>
            <a href="/terms" className={linkCls}>
              Terms
            </a>
            <a href="https://playam.app" className={linkCls}>
              A game from Playam
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
