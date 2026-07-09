import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@clerk/react'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import { Loader2, Minus, Plus, Gift } from 'lucide-react'

const FREE_GAME_LIMIT = 3
const GAMES_CREATED_KEY = 'rvai_games_created'

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const Stepper: React.FC<{
  value: number
  onChange: (n: number) => void
  min: number
  max: number
}> = ({ value, onChange, min, max }) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => onChange(clamp(value - 1, min, max))}
      className="w-11 h-11 rounded-[14px] bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#FFF8F0] transition-colors disabled:opacity-40"
      disabled={value <= min}
      aria-label="Decrease"
    >
      <Minus className="w-5 h-5" />
    </button>
    <span className="font-display font-extrabold text-[28px] text-[#FFF8F0] w-12 text-center tabular-nums">
      {value}
    </span>
    <button
      type="button"
      onClick={() => onChange(clamp(value + 1, min, max))}
      className="w-11 h-11 rounded-[14px] bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#FFF8F0] transition-colors disabled:opacity-40"
      disabled={value >= max}
      aria-label="Increase"
    >
      <Plus className="w-5 h-5" />
    </button>
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
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[460px] mx-auto"
        >
          <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-[20px] bg-[#FFC94D]/15 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8 text-[#FFC94D]" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-2xl text-[#FFF8F0]">
                You've used your free games
              </h2>
              <p className="text-[#9AA3D0] text-sm mt-3">
                Create a free account to keep the parties going — or go Pro to remove ads.
              </p>
            </div>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => navigate('/sign-up')}>
                Create free account
              </Button>
              <Button variant="ghost" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>
                View Pro plans
              </Button>
              <button
                onClick={() => navigate('/')}
                className="font-body text-sm text-[#6E77A8] hover:text-[#FFF8F0] transition-colors"
              >
                ← Back home
              </button>
            </div>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[460px] mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-4xl text-[#FFF8F0]">Set up your party</h1>
          <p className="text-[#9AA3D0] mt-2">Two knobs and you're off</p>
        </div>

        <div className="rounded-[24px] border border-white/[0.07] bg-[#1F2450] p-6">
          {/* Rounds */}
          <div className="flex items-center justify-between py-5">
            <div>
              <p className="font-display font-bold text-[#FFF8F0]">Rounds</p>
              <p className="text-[#9AA3D0] text-sm">How many photo pairs</p>
            </div>
            <Stepper value={rounds} onChange={setRounds} min={1} max={20} />
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Seconds per round */}
          <div className="flex items-center justify-between py-5">
            <div>
              <p className="font-display font-bold text-[#FFF8F0]">Seconds per round</p>
              <p className="text-[#9AA3D0] text-sm">Faster = more chaos</p>
            </div>
            <Stepper value={timeLimit} onChange={setTimeLimit} min={5} max={60} />
          </div>

          <div className="h-px bg-white/[0.07]" />

          {/* Show votes */}
          <div className="py-5">
            <p className="font-display font-bold text-[#FFF8F0] mb-3">Show votes</p>
            <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-white/5 p-1">
              {(
                [
                  { mode: 'instant', label: 'Live 👀' },
                  { mode: 'after_round', label: 'At the end 🤫' },
                ] as const
              ).map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRevealMode(mode)}
                  className={`h-11 rounded-[12px] font-display font-bold text-sm transition-all ${
                    revealMode === mode
                      ? 'bg-[#57E6D2] text-[#151936]'
                      : 'text-[#9AA3D0] hover:text-[#FFF8F0]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[#9AA3D0] text-sm mt-3">
              Live shows everyone's picks as they happen
            </p>
          </div>
        </div>

        <Button size="lg" className="w-full mt-6" onClick={handleCreateGame} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating…
            </>
          ) : (
            'Create party 🎉'
          )}
        </Button>
      </motion.div>
    </GameLayout>
  )
}

export default CreateGame
