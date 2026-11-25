import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { Button } from '@/components/ui/button'
import Seo from '@/components/Seo'
import { Loader2 } from 'lucide-react'
import { ArrowRight, Wordmark } from '@/components/Brand'

const FREE_GAME_LIMIT = 3
const GAMES_CREATED_KEY = 'rvai_games_created'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const Stepper: React.FC<{
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  labelId: string
  less: string
  more: string
}> = ({ value, onChange, min, max, labelId, less, more }) => (
  <div
    role="group"
    aria-labelledby={labelId}
    className="flex items-stretch h-24 border-4 border-ink bg-paper text-ink"
  >
    <button
      type="button"
      onClick={() => onChange(clamp(value - 1, min, max))}
      className="w-24 border-r-4 border-ink type-display text-[44px] hover:bg-ink hover:text-paper transition-colors disabled:text-text-placeholder disabled:bg-paper disabled:cursor-not-allowed"
      disabled={value <= min}
      aria-label={less}
    >
      −
    </button>
    <span className="flex-1 flex items-center justify-center type-display text-[64px] tabular-nums">
      {value}
    </span>
    <button
      type="button"
      onClick={() => onChange(clamp(value + 1, min, max))}
      className="w-24 border-l-4 border-ink type-display text-[44px] hover:bg-ink hover:text-paper transition-colors disabled:text-text-placeholder disabled:bg-paper disabled:cursor-not-allowed"
      disabled={value >= max}
      aria-label={more}
    >
      +
    </button>
  </div>
)

const FieldHead: React.FC<{ id: string; title: string; hint: string }> = ({ id, title, hint }) => (
  <div className="flex items-baseline justify-between gap-4">
    <span id={id} className="type-name text-[26px]">
      {title}
    </span>
    <span className="font-semibold text-base text-text-muted text-right">{hint}</span>
  </div>
)

const CreateGame: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()

  const gamesCreated = parseInt(localStorage.getItem(GAMES_CREATED_KEY) ?? '0', 10)
  const atFreeLimit = !isSignedIn && gamesCreated >= FREE_GAME_LIMIT

  const [loading, setLoading] = useState(false)
  const [rounds, setRounds] = useState(10)
  const [timeLimit, setTimeLimit] = useState(15)
  const [revealMode, setRevealMode] = useState<'instant' | 'after_round'>('instant')

  const generateGameCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
    return code
  }

  const handleCreateGame = () => {
    setLoading(true)
    if (!isSignedIn) localStorage.setItem(GAMES_CREATED_KEY, String(gamesCreated + 1))
    const code = generateGameCode()
    navigate(`/lobby/${code}`, { state: { rounds, timeLimit, revealMode } })
  }

  if (atFreeLimit) {
    return (
      <main className="min-h-dvh bg-side-b text-paper flex flex-col">
        <Seo title="Create a game - Real or AI" path="/create" noindex />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-14 py-10 flex flex-col gap-10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="self-start py-3 type-label text-base"
          >
            <Wordmark className="text-xl" />
          </button>
          <div className="flex flex-col gap-5 mt-auto">
            <h1 className="type-display text-[clamp(48px,8vw,96px)] leading-[0.88]">
              Free games used up.
            </h1>
            <p className="text-xl font-medium leading-snug text-on-blue-muted max-w-[34ch]">
              Make a free account to keep the parties going, or go Pro to remove ads.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-auto">
            <Button size="lg" onClick={() => navigate('/sign-up')}>
              Create free account <ArrowRight />
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/dashboard')}>
              View Pro plans
            </Button>
          </div>
        </div>
      </main>
    )
  }

  const minutes = Math.max(1, Math.round((rounds * (timeLimit + 8)) / 60))

  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2 bg-paper text-ink">
      <Seo title="Create a game - Real or AI" path="/create" noindex />
      <section className="bg-side-a text-ink px-4 md:px-14 py-8 md:py-12 flex flex-col justify-between gap-12">
        <div className="flex items-center justify-between type-label text-base">
          <button type="button" onClick={() => navigate('/')} className="py-3">
            <Wordmark className="text-xl" />
          </button>
          <button type="button" onClick={() => navigate('/')} className="py-3 underline underline-offset-4">
            Back
          </button>
        </div>
        <div className="flex flex-col gap-6">
          <h1 className="type-display text-[clamp(56px,7vw,112px)] leading-[0.88]">
            Set up
            <br />
            your party.
          </h1>
          <p className="text-xl font-medium leading-snug max-w-[30ch]">
            Two numbers and one switch. Put this screen on the TV, then everyone joins from their
            phone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 type-label text-base">
          <span className="bg-ink text-paper px-3.5 py-2.5">{rounds} rounds</span>
          <span className="bg-ink text-paper px-3.5 py-2.5">{timeLimit} sec each</span>
          <span className="bg-ink text-paper px-3.5 py-2.5">About {minutes} min</span>
        </div>
      </section>

      <section className="px-4 md:px-14 py-8 md:py-12 flex flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <FieldHead id="rounds-label" title="Rounds" hint="How many photo pairs" />
          <Stepper
            value={rounds}
            onChange={setRounds}
            min={1}
            max={20}
            labelId="rounds-label"
            less="Fewer rounds"
            more="More rounds"
          />
        </div>

        <div className="flex flex-col gap-3">
          <FieldHead id="seconds-label" title="Seconds" hint="Less time, more chaos" />
          <Stepper
            value={timeLimit}
            onChange={setTimeLimit}
            min={5}
            max={60}
            labelId="seconds-label"
            less="Less time"
            more="More time"
          />
        </div>

        <div className="flex flex-col gap-3">
          <FieldHead id="votes-label" title="Show votes" hint="On the TV, during the round" />
          <div role="group" aria-labelledby="votes-label" className="grid grid-cols-2 h-20 border-4 border-ink">
            {(
              [
                { mode: 'instant', label: 'Live' },
                { mode: 'after_round', label: 'After the round' },
              ] as const
            ).map(({ mode, label }, i) => (
              <button
                key={mode}
                type="button"
                aria-pressed={revealMode === mode}
                onClick={() => setRevealMode(mode)}
                className={`type-name text-[clamp(16px,1.6vw,22px)] transition-colors ${
                  i > 0 ? 'border-l-4 border-ink' : ''
                } ${revealMode === mode ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="secondary"
          className="h-[104px] w-full justify-between px-8 text-[clamp(24px,2.4vw,34px)] [&_svg]:size-9"
          onClick={handleCreateGame}
          disabled={loading}
        >
          {loading ? (
            <>
              Opening… <Loader2 className="animate-spin" />
            </>
          ) : (
            <>
              Open the lobby <ArrowRight />
            </>
          )}
        </Button>
      </section>
    </main>
  )
}

export default CreateGame
