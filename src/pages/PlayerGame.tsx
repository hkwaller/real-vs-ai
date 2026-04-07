import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
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
  const roundStartTimeRef = useRef<number>(Date.now())

  const updatePresence = useUpdateMyPresence()

  const gameStatus = useStorage((root) => root.gameStatus?.value ?? null)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const rounds = useStorage((root) => root.rounds)
  const settingsObj = useStorage((root) => root.settings)
  const scoresMap = useStorage((root) => root.scores)

  const currentRoundIndex = currentRoundIndexObj?.value ?? 0
  const currentRound = rounds?.[currentRoundIndex] ?? null
  const timeLimit = settingsObj?.timeLimit ?? 15

  const registerPlayer = useMutation(
    ({ storage }) => {
      const playerList = storage.get('players')
      const scoreMap = storage.get('scores')
      for (let i = 0; i < playerList.length; i++) {
        if (playerList.get(i)?.id === playerId) return
      }
      playerList.push({ id: playerId, name: playerName, emoji: playerEmoji })
      scoreMap.set(playerId, 0)
    },
    [playerId, playerName, playerEmoji],
  )

  useEffect(() => {
    if (registered || gameStatus === null) return
    setRegistered(true)
    registerPlayer()
  }, [gameStatus, registered])

  // Countdown timer — resets when round changes
  useEffect(() => {
    roundStartTimeRef.current = Date.now()
    setTimeRemaining(timeLimit)
    setHasVoted(false)
    setVoteChoice(null)
    voteChoiceRef.current = null
    setRoundResult(null)
    updatePresence({ hasVoted: false, currentVote: null, timeRemaining: null })

    const interval = setInterval(() => {
      const elapsed = (Date.now() - roundStartTimeRef.current) / 1000
      setTimeRemaining(Math.max(0, Math.ceil(timeLimit - elapsed)))
    }, 250) // 250ms for smooth display
    return () => clearInterval(interval)
  }, [currentRound?.id, timeLimit])

  const handleVote = (choice: 'A' | 'B') => {
    if (hasVoted) return
    const elapsed = (Date.now() - roundStartTimeRef.current) / 1000
    const remaining = Math.max(0, timeLimit - elapsed)
    setVoteChoice(choice)
    voteChoiceRef.current = choice
    setHasVoted(true)
    updatePresence({ hasVoted: true, currentVote: choice, timeRemaining: remaining })
  }

  useEventListener(({ event }) => {
    if (event.type !== 'PLAYER_KICKED') return
    if (event.playerId !== playerId) return
    if (playerId) localStorage.removeItem(`rvai_player_${playerId}`)
    navigate('/join')
  })

  useEventListener(({ event }) => {
    if (event.type !== 'ROUND_REVEALED') return
    const { correctChoice, scores } = event
    const myChoice = voteChoiceRef.current
    if (!myChoice) {
      setRoundResult({ didVote: false, correct: false, correctChoice, points: 0 })
      return
    }
    const correct = myChoice === correctChoice
    // Use the points the host calculated — single source of truth
    const points = scores[playerId] ?? 0
    setRoundResult({ didVote: true, correct, correctChoice, points })
  })

  // Game over
  if (gameStatus === 'finished') {
    return (
      <GameLayout>
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 max-w-sm mx-auto text-center space-y-6">
          <Trophy className="w-14 h-14 text-[#FFB830] mx-auto" />
          <div>
            <p className="mission-label mb-2">Debrief</p>
            <h1 className="font-orbitron text-3xl font-black text-[#FF6B1A] uppercase">
              Mission Complete
            </h1>
            <p className="text-[#8B97C8] mt-2 text-sm">Check the main screen for results.</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline">
            Return to Base
          </Button>
        </div>
      </GameLayout>
    )
  }

  // Waiting
  if (gameStatus !== 'playing' || !currentRound) {
    return (
      <GameLayout>
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 max-w-sm mx-auto text-center space-y-6">
          <Loader2 className="w-10 h-10 text-[#FF6B1A] mx-auto animate-spin" />
          <div>
            <p className="mission-label mb-2">Standby</p>
            <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
              Awaiting Host
            </h1>
            <p className="font-space-mono text-xs text-[#8B97C8] mt-3">// Get ready, operative</p>
          </div>
          <button
            onClick={() => navigate('/join')}
            className="font-space-mono text-xs text-[#8B97C8] hover:text-[#F5F0E8] transition-colors"
          >
            ← Wrong code? Go back
          </button>
        </div>
      </GameLayout>
    )
  }

  // Standings
  const sortedScores = scoresMap
    ? [...scoresMap.entries()].sort((a, b) => b[1] - a[1])
    : []
  const myScore = scoresMap?.get(playerId) ?? 0
  const myPosition = sortedScores.findIndex(([id]) => id === playerId) + 1
  const playerCount = sortedScores.length
  const leaderScore = sortedScores[0]?.[1] ?? 0
  const secondScore = sortedScores[1]?.[1] ?? 0
  const isLeader = myPosition === 1
  const gap = isLeader ? myScore - secondScore : leaderScore - myScore
  const showStandings = playerCount > 1

  return (
    <GameLayout>
      <div className="flex flex-col items-center gap-8 w-full max-w-sm mx-auto">
        {/* Player + round info */}
        <div className="text-center space-y-1">
          <p className="text-2xl">{playerEmoji}</p>
          <p className="font-orbitron text-sm font-bold text-[#F5F0E8] uppercase tracking-widest">
            {playerName}
          </p>
          <p className="mission-label">Round {currentRoundIndex + 1}</p>
        </div>

        {/* Score HUD */}
        <div className="w-full corner-bracket bg-[#111840] border border-[#2A3468] px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-center">
            <p className="mission-label text-[10px]">Score</p>
            <p className="font-space-mono font-bold text-xl text-[#FFB830]">{myScore}</p>
          </div>

          {showStandings && (
            <>
              <div className="h-8 w-px bg-[#2A3468]" />
              <div className="text-center">
                <p className="mission-label text-[10px]">Position</p>
                <p className="font-space-mono font-bold text-xl text-[#F5F0E8]">
                  #{myPosition}
                  <span className="text-[#8B97C8] text-sm font-normal"> / {playerCount}</span>
                </p>
              </div>
              <div className="h-8 w-px bg-[#2A3468]" />
              <div className="text-center min-w-0">
                <p className="mission-label text-[10px]">{isLeader ? 'Ahead' : 'Behind'}</p>
                <p className={`font-space-mono font-bold text-xl ${isLeader ? 'text-[#00FFE5]' : 'text-[#FF3D1A]'}`}>
                  {isLeader ? '+' : '-'}{gap}
                  <span className="text-[#8B97C8] text-xs font-normal"> pts</span>
                </p>
              </div>
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {roundResult ? (
            // Result
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div
                className={`corner-bracket border-2 p-10 text-center space-y-5 ${
                  !roundResult.didVote
                    ? 'bg-[#FFB830]/10 border-[#FFB830]'
                    : roundResult.correct
                      ? 'bg-[#00FFE5]/10 border-[#00FFE5]'
                      : 'bg-[#FF3D1A]/10 border-[#FF3D1A]'
                }`}
              >
                <div className="text-6xl">
                  {!roundResult.didVote ? '⏰' : roundResult.correct ? '✅' : '❌'}
                </div>
                <div>
                  <h2
                    className={`font-orbitron text-3xl font-black uppercase ${
                      !roundResult.didVote
                        ? 'text-[#FFB830]'
                        : roundResult.correct
                          ? 'text-[#00FFE5]'
                          : 'text-[#FF3D1A]'
                    }`}
                  >
                    {!roundResult.didVote ? 'Too Slow' : roundResult.correct ? 'Correct' : 'Wrong'}
                  </h2>
                  <p className="text-[#8B97C8] mt-2 text-sm">
                    Option{' '}
                    <span className="font-bold text-[#F5F0E8]">{roundResult.correctChoice}</span> was
                    the real photo
                  </p>
                </div>
                {roundResult.correct && (
                  <div className="border border-[#FFB830]/50 bg-[#FFB830]/10 px-6 py-2 inline-block">
                    <span className="font-space-mono font-bold text-2xl text-[#FFB830]">
                      +{roundResult.points} PTS
                    </span>
                  </div>
                )}
                <p className="font-space-mono text-xs text-[#8B97C8] animate-pulse">
                  // Awaiting next round...
                </p>
              </div>
            </motion.div>
          ) : !hasVoted ? (
            // Vote buttons
            <motion.div
              key="vote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-4"
            >
              <div className="text-center">
                <p className="mission-label mb-1">Time Remaining</p>
                <span
                  className={`font-space-mono text-5xl font-bold ${
                    timeRemaining <= 5 ? 'text-[#FF3D1A] animate-pulse' : 'text-[#FF6B1A]'
                  }`}
                >
                  {timeRemaining}
                </span>
              </div>

              <p className="font-orbitron text-lg font-bold text-[#F5F0E8] text-center uppercase tracking-widest">
                Which is Real?
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleVote('A')}
                className="w-full h-28 bg-[#FF6B1A] text-[#0B0F2E] font-orbitron text-5xl font-black hover:bg-[#FF8C42] hover:shadow-[0_0_30px_rgba(255,107,26,0.5)] transition-all"
              >
                A
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleVote('B')}
                className="w-full h-28 bg-[#1A2355] border-2 border-[#FF6B1A] text-[#FF6B1A] font-orbitron text-5xl font-black hover:bg-[#FF6B1A]/20 hover:shadow-[0_0_30px_rgba(255,107,26,0.3)] transition-all"
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
              <div className="corner-bracket bg-[#111840] border border-[#FF6B1A] p-10 text-center space-y-5">
                <div className="font-orbitron text-7xl font-black text-[#FF6B1A] text-glow-orange">
                  {voteChoice}
                </div>
                <div>
                  <h2 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
                    Vote Locked
                  </h2>
                  <p className="text-[#8B97C8] text-sm mt-1">You chose Option {voteChoice}</p>
                </div>
                <p className="font-space-mono text-xs text-[#00FFE5] animate-pulse">
                  // Awaiting results...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameLayout>
  )
}

const PlayerGame: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

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
