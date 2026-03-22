import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { Loader2, Trophy } from 'lucide-react'
import {
  RoomProvider,
  useStorage,
  useMutation,
  useUpdateMyPresence,
  useEventListener,
  LiveList,
  LiveMap,
  LiveObject,
} from '@/liveblocks.config'

// Inner component — uses Liveblocks hooks
type RoundResult = {
  didVote: boolean
  correct: boolean
  correctChoice: 'A' | 'B'
  points: number
}

const PlayerGameContent: React.FC<{
  playerId: string
  playerName: string
  playerEmoji: string
}> = ({ playerId, playerName, playerEmoji }) => {
  const navigate = useNavigate()
  const [hasVoted, setHasVoted] = useState(false)
  const [voteChoice, setVoteChoice] = useState<'A' | 'B' | null>(null)
  const [registered, setRegistered] = useState(false)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(15)
  const voteChoiceRef = useRef<'A' | 'B' | null>(null)
  const timeRemainingRef = useRef<number>(15)

  const updatePresence = useUpdateMyPresence()

  // Liveblocks storage — null while loading, value once hydrated
  const gameStatus = useStorage((root) => root.gameStatus?.value ?? null)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const rounds = useStorage((root) => root.rounds)
  const settingsObj = useStorage((root) => root.settings)

  const currentRoundIndex = currentRoundIndexObj?.value ?? 0
  const currentRound = rounds?.[currentRoundIndex] ?? null
  const timeLimit = settingsObj?.timeLimit ?? 15

  // Register player in Storage once storage has loaded (deduplicates by playerId)
  const registerPlayer = useMutation(
    ({ storage }) => {
      const playerList = storage.get('players')
      const scoreMap = storage.get('scores')
      for (let i = 0; i < playerList.length; i++) {
        if (playerList.get(i)?.id === playerId) return // already registered
      }
      playerList.push({ id: playerId, name: playerName, emoji: playerEmoji })
      scoreMap.set(playerId, 0)
    },
    [playerId, playerName, playerEmoji],
  )

  // Wait for storage to hydrate (gameStatus !== null) before registering
  useEffect(() => {
    if (registered || gameStatus === null) return
    setRegistered(true)
    registerPlayer()
  }, [gameStatus, registered])

  // Countdown timer — resets when round changes, stops when player has voted
  useEffect(() => {
    const start = timeLimit
    setTimeRemaining(start)
    timeRemainingRef.current = start
    setHasVoted(false)
    setVoteChoice(null)
    voteChoiceRef.current = null
    setRoundResult(null)
    updatePresence({ hasVoted: false, currentVote: null, timeRemaining: null })

    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        const next = Math.max(0, t - 1)
        timeRemainingRef.current = next
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [currentRoundIndex, timeLimit])

  // Stop the timer once voted (by clearing it via the hasVoted flag)
  useEffect(() => {
    if (!hasVoted) return
    // Timer ref already captured at vote time; nothing extra needed
  }, [hasVoted])

  const handleVote = (choice: 'A' | 'B') => {
    if (hasVoted) return
    const remaining = timeRemainingRef.current
    setVoteChoice(choice)
    voteChoiceRef.current = choice
    setHasVoted(true)
    updatePresence({ hasVoted: true, currentVote: choice, timeRemaining: remaining })
  }

  // If the host removes this player, send them back to the join screen
  useEventListener(({ event }) => {
    if (event.type !== 'PLAYER_KICKED') return
    if (event.playerId !== playerId) return
    if (playerId) localStorage.removeItem(`rvai_player_${playerId}`)
    navigate('/join')
  })

  // When the host reveals results, show correct/wrong feedback
  useEventListener(({ event }) => {
    if (event.type !== 'ROUND_REVEALED') return
    if (!currentRound) return
    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice: 'A' | 'B' = isRealLeft ? 'A' : 'B'
    const myChoice = voteChoiceRef.current
    if (!myChoice) {
      setRoundResult({ didVote: false, correct: false, correctChoice, points: 0 })
      return
    }
    const correct = myChoice === correctChoice
    const tr = timeRemainingRef.current
    const points = correct ? Math.max(10, Math.round(100 * (tr / timeLimit))) : 0
    setRoundResult({ didVote: true, correct, correctChoice, points })
  })

  // Game over
  if (gameStatus === 'finished') {
    return (
      <GameLayout>
        <Card className="text-center p-10">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2 text-white">Game Over!</h1>
          <p className="text-muted-foreground">Check the main screen for results.</p>
          <Button className="mt-6" onClick={() => navigate('/')} variant="outline">
            Exit
          </Button>
        </Card>
      </GameLayout>
    )
  }

  // Waiting (game not started or between rounds)
  if (gameStatus !== 'playing' || !currentRound) {
    return (
      <GameLayout>
        <Card className="text-center p-10 border-0">
          <Loader2 className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold">Waiting for Host...</h1>
          <p className="text-muted-foreground mt-2">Get ready!</p>
          <button
            onClick={() => navigate('/join')}
            className="mt-6 text-xs text-muted-foreground underline underline-offset-4"
          >
            Wrong game code? Go back
          </button>
        </Card>
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      <div className="flex flex-col items-center space-y-8 w-full max-w-md mx-auto">
        <div className="text-center">
          <span className="text-2xl text-muted-foreground">
            {playerName} ({playerEmoji})
          </span>
          <h2 className="text-xl font-medium text-indigo-300">Round {currentRoundIndex + 1}</h2>
          <h1 className="text-3xl font-bold mt-2">Which is REAL?</h1>
        </div>

        <AnimatePresence mode="wait">
          {roundResult ? (
            // Result reveal screen
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full"
            >
              <Card
                className={`w-full text-center py-10 border-2 ${
                  !roundResult.didVote
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : roundResult.correct
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-red-500/50 bg-red-500/10'
                }`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="text-7xl">
                    {!roundResult.didVote ? '⏰' : roundResult.correct ? '✅' : '❌'}
                  </div>
                  <div>
                    <h2
                      className={`text-3xl font-black ${
                        !roundResult.didVote
                          ? 'text-yellow-400'
                          : roundResult.correct
                            ? 'text-green-400'
                            : 'text-red-400'
                      }`}
                    >
                      {!roundResult.didVote
                        ? "Too slow!"
                        : roundResult.correct
                          ? 'Correct!'
                          : 'Wrong!'}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Option{' '}
                      <span className="font-bold text-white">{roundResult.correctChoice}</span> was
                      the real photo
                    </p>
                  </div>
                  {roundResult.correct && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-full px-6 py-2">
                      <span className="text-yellow-400 font-black text-2xl">
                        +{roundResult.points} pts
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Waiting for next round...
                  </p>
                </div>
              </Card>
            </motion.div>
          ) : !hasVoted ? (
            // Voting buttons
            <motion.div
              key="vote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 w-full"
            >
              <div className="flex justify-center">
                <span
                  className={`text-sm font-mono tabular-nums ${timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-muted-foreground'}`}
                >
                  {timeRemaining}s
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleVote('A')}
                className="h-32 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl text-4xl font-black shadow-lg border-2 border-white/10 hover:border-white/30 transition-all"
              >
                A
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleVote('B')}
                className="h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl text-4xl font-black shadow-lg border-2 border-white/10 hover:border-white/30 transition-all"
              >
                B
              </motion.button>
            </motion.div>
          ) : (
            // Waiting for reveal
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <Card className="w-full text-center py-10">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={`text-6xl font-black ${voteChoice === 'A' ? 'text-indigo-400' : 'text-pink-400'}`}
                  >
                    {voteChoice}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Vote Cast!</h2>
                    <p className="text-muted-foreground">You chose Option {voteChoice}</p>
                  </div>
                  <p className="text-sm text-indigo-300 animate-pulse mt-4">
                    Waiting for results...
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameLayout>
  )
}

// Outer component — mounts RoomProvider
const PlayerGame: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Player identity lives in localStorage keyed by the pid in the URL,
  // so multiple tabs in the same browser each get their own independent identity.
  const playerId = searchParams.get('pid')
  const playerData = playerId
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem(`rvai_player_${playerId}`) ?? 'null') as {
            name: string
            emoji: string
          } | null
        } catch {
          return null
        }
      })()
    : null
  const playerName = playerData?.name ?? ''
  const playerEmoji = playerData?.emoji ?? '😀'

  useEffect(() => {
    if (!playerId || !playerData) navigate(`/join${code ? `?code=${code}` : ''}`)
  }, [playerId, playerData, navigate, code])

  if (!playerId || !playerData || !code) return null

  return (
    <RoomProvider
      id={code}
      initialPresence={{
        name: playerName,
        emoji: playerEmoji,
        playerId,
        isHost: false,
        hasVoted: false,
        currentVote: null,
        timeRemaining: null,
      }}
      initialStorage={{
        gameStatus: new LiveObject({ value: 'waiting' }),
        settings: new LiveObject({ rounds: 10, timeLimit: 15, revealMode: 'instant' }),
        currentRoundIndex: new LiveObject({ value: 0 }),
        rounds: new LiveList([]),
        votes: new LiveMap(),
        scores: new LiveMap(),
        players: new LiveList([]),
      }}
    >
      <PlayerGameContent playerId={playerId} playerName={playerName} playerEmoji={playerEmoji} />
    </RoomProvider>
  )
}

export default PlayerGame
