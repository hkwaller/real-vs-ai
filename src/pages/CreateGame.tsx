import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@clerk/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { Loader2, Clock, Images, Play, Eye, EyeOff, Gift, Rocket } from 'lucide-react'

const FREE_GAME_LIMIT = 3
const GAMES_CREATED_KEY = 'rvai_games_created'

const CreateGame: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()

  const gamesCreated = parseInt(localStorage.getItem(GAMES_CREATED_KEY) ?? '0', 10)
  const atFreeLimit = !isSignedIn && gamesCreated >= FREE_GAME_LIMIT

  const [loading, setLoading] = useState(false)
  const [rounds, setRounds] = useState<number | string>(10)
  const [timeLimit, setTimeLimit] = useState<number | string>(15)
  const [revealMode, setRevealMode] = useState<'instant' | 'after_round'>('instant')

  const generateGameCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleCreateGame = () => {
    setLoading(true)
    if (!isSignedIn) {
      localStorage.setItem(GAMES_CREATED_KEY, String(gamesCreated + 1))
    }
    const code = generateGameCode()
    navigate(`/lobby/${code}`, {
      state: {
        rounds: Number(rounds),
        timeLimit: Number(timeLimit),
        revealMode,
      },
    })
  }

  if (atFreeLimit) {
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-8 text-center space-y-6">
            <div className="w-16 h-16 border-2 border-[#FFB830] flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8 text-[#FFB830]" />
            </div>
            <div>
              <p className="mission-label mb-2">Access Denied</p>
              <h2 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
                Free Missions Used
              </h2>
              <p className="text-[#8B97C8] text-sm mt-3">
                You've completed your {FREE_GAME_LIMIT} free missions. Create a free account to
                continue — or go Pro to remove ads.
              </p>
            </div>
            <div className="space-y-3">
              <Button size="lg" className="w-full" onClick={() => navigate('/sign-up')}>
                Create Free Account
              </Button>
              <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>
                View Pro Plans
              </Button>
              <button
                onClick={() => navigate('/')}
                className="font-space-mono text-xs text-[#8B97C8] hover:text-[#F5F0E8] transition-colors"
              >
                ← Return to base
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
        className="w-full max-w-md mx-auto"
      >
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-8 space-y-8">
          <div>
            <p className="mission-label mb-2">Setup</p>
            <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase tracking-wide">
              Mission Config
            </h1>
            <p className="text-[#8B97C8] text-sm mt-1">Configure your game parameters</p>
          </div>

          <div className="space-y-6">
            {/* Rounds */}
            <div className="space-y-2">
              <label className="mission-label flex items-center gap-2">
                <Images className="w-3 h-3" />
                Rounds
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                className="bg-[#0B0F2E] border-[#2A3468] text-[#F5F0E8] font-space-mono text-lg focus:border-[#FF6B1A] focus:ring-[#FF6B1A]/20 h-12"
              />
            </div>

            {/* Time limit */}
            <div className="space-y-2">
              <label className="mission-label flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Time Per Round (seconds)
              </label>
              <Input
                type="number"
                min="5"
                max="60"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="bg-[#0B0F2E] border-[#2A3468] text-[#F5F0E8] font-space-mono text-lg focus:border-[#FF6B1A] focus:ring-[#FF6B1A]/20 h-12"
              />
            </div>

            {/* Reveal mode */}
            <div className="space-y-2">
              <label className="mission-label flex items-center gap-2">
                {revealMode === 'instant' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Reveal Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRevealMode('instant')}
                  className={`py-3 px-4 text-xs font-orbitron font-bold uppercase tracking-widest transition-all border ${
                    revealMode === 'instant'
                      ? 'bg-[#FF6B1A] text-[#0B0F2E] border-[#FF6B1A] shadow-[0_0_15px_rgba(255,107,26,0.3)]'
                      : 'bg-transparent text-[#8B97C8] border-[#2A3468] hover:border-[#FF6B1A] hover:text-[#FF6B1A]'
                  }`}
                >
                  Instantly
                </button>
                <button
                  type="button"
                  onClick={() => setRevealMode('after_round')}
                  className={`py-3 px-4 text-xs font-orbitron font-bold uppercase tracking-widest transition-all border ${
                    revealMode === 'after_round'
                      ? 'bg-[#FF6B1A] text-[#0B0F2E] border-[#FF6B1A] shadow-[0_0_15px_rgba(255,107,26,0.3)]'
                      : 'bg-transparent text-[#8B97C8] border-[#2A3468] hover:border-[#FF6B1A] hover:text-[#FF6B1A]'
                  }`}
                >
                  After Round
                </button>
              </div>
              <p className="font-space-mono text-xs text-[#8B97C8]">
                // {revealMode === 'instant' ? 'Votes are shown as they happen.' : 'Votes are hidden until round ends.'}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleCreateGame}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Initialize Mission
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </GameLayout>
  )
}

export default CreateGame
