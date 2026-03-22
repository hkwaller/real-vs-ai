import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@clerk/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { Loader2, Settings, Clock, Images, Play, Eye, EyeOff, Gift } from 'lucide-react'

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
          <Card className="text-white text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                <Gift className="w-8 h-8 text-yellow-400" />
              </div>
              <CardTitle className="text-2xl">Free Games Used</CardTitle>
              <CardDescription>
                You've hosted your {FREE_GAME_LIMIT} free games. Create a free account to keep
                playing — or go Pro to remove ads.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3">
              <Button variant="neon" size="lg" className="w-full" onClick={() => navigate('/sign-up')}>
                Create Free Account
              </Button>
              <Button variant="outline" size="lg" className="w-full text-black" onClick={() => navigate('/dashboard')}>
                View Pro Plans
              </Button>
              <button
                onClick={() => navigate('/')}
                className="text-xs text-muted-foreground underline underline-offset-4"
              >
                Back to home
              </button>
            </CardFooter>
          </Card>
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
        <Card className="text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-indigo-400" />
              Game Settings
            </CardTitle>
            <CardDescription>Configure your match</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Images className="w-4 h-4 text-muted-foreground" />
                Number of Rounds
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                className="bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Time Limit (seconds)
              </label>
              <Input
                type="number"
                min="5"
                max="60"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                {revealMode === 'instant' ? (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                )}
                Reveal Answers
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={revealMode === 'instant' ? 'neon' : 'outline'}
                  onClick={() => setRevealMode('instant')}
                  className={`w-full ${revealMode === 'instant' ? 'text-white' : 'text-black'}`}
                >
                  Instantly
                </Button>
                <Button
                  type="button"
                  variant={revealMode === 'after_round' ? 'neon' : 'outline'}
                  onClick={() => setRevealMode('after_round')}
                  className={`w-full ${revealMode === 'after_round' ? 'text-white' : 'text-black'}`}
                >
                  After Round
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {revealMode === 'instant'
                  ? 'Votes are shown as they happen.'
                  : 'Votes are hidden until the round ends.'}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="neon"
              size="lg"
              className="w-full"
              onClick={handleCreateGame}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Create Lobby
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </GameLayout>
  )
}

export default CreateGame
