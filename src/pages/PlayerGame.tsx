import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import CountdownRing from '@/components/CountdownRing'
import { Loader2 } from 'lucide-react'
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

const GRACE_PERIOD = 3

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
  const [streak, setStreak] = useState(0)
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
  const totalRounds = settingsObj?.rounds ?? rounds?.length ?? 0

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

  // Countdown — resets when round changes
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
    }, 250)
    return () => clearInterval(interval)
  }, [currentRound?.id, timeLimit])

  const handleVote = (choice: 'A' | 'B') => {
    if (hasVoted) return
    navigator.vibrate?.(10)
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
      setStreak(0)
      setRoundResult({ didVote: false, correct: false, correctChoice, points: 0 })
      return
    }
    const correct = myChoice === correctChoice
    const points = scores[playerId] ?? 0
    setStreak((s) => (correct ? s + 1 : 0))
    setRoundResult({ didVote: true, correct, correctChoice, points })
  })

  // Potential points right now (mirrors host scoring with this game's time limit).
  const scoringWindow = Math.max(1, timeLimit - GRACE_PERIOD)
  const potentialPoints =
    timeRemaining >= scoringWindow ? 100 : Math.round(100 * (timeRemaining / scoringWindow))
  const timeFraction = Math.max(0, Math.min(1, timeRemaining / timeLimit))
  const myScore = scoresMap?.get(playerId) ?? 0

  // Game over
  if (gameStatus === 'finished') {
    return (
      <GameLayout>
        <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-10 max-w-sm mx-auto text-center space-y-4">
          <div className="text-5xl">🏁</div>
          <h1 className="font-display font-extrabold text-3xl text-[#FFF8F0]">That's a wrap!</h1>
          <p className="text-[#9AA3D0] text-sm">Check the big screen for the final standings.</p>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </GameLayout>
    )
  }

  // Waiting
  if (gameStatus !== 'playing' || !currentRound) {
    return (
      <GameLayout>
        <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-10 max-w-sm mx-auto text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#FF8552] mx-auto animate-spin" />
          <h1 className="font-display font-extrabold text-2xl text-[#FFF8F0]">Get ready, {playerName}</h1>
          <p className="text-[#9AA3D0] text-sm">Waiting for the host to start…</p>
          <button
            onClick={() => navigate('/join')}
            className="font-body text-sm text-[#6E77A8] hover:text-[#FFF8F0] transition-colors"
          >
            ← Wrong code? Go back
          </button>
        </div>
      </GameLayout>
    )
  }

  // Result (3f)
  if (roundResult) {
    const correct = roundResult.correct
    const ringColor = correct ? '#57E6D2' : '#FF6A6A'
    return (
      <GameLayout>
        <div className="relative max-w-sm mx-auto flex flex-col items-center text-center pt-6">
          {/* Confetti squares (correct only) */}
          {correct &&
            [
              { x: -120, c: '#FFC94D' },
              { x: 120, c: '#FF8552' },
              { x: -150, c: '#FF8552' },
              { x: 150, c: '#57E6D2' },
              { x: -60, c: '#57E6D2' },
              { x: 70, c: '#FFC94D' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ y: -40, opacity: 0, rotate: 0 }}
                animate={{ y: 40 + (i % 3) * 30, opacity: [0, 1, 1], rotate: 180 }}
                transition={{ duration: 1.2, delay: i * 0.06 }}
                className="absolute top-0 w-3 h-3 rounded-[3px]"
                style={{ left: `calc(50% + ${s.x}px)`, backgroundColor: s.c }}
              />
            ))}

          <div
            className="w-28 h-28 rounded-full flex items-center justify-center text-5xl mb-6"
            style={{ border: `4px solid ${ringColor}` }}
          >
            {playerEmoji}
          </div>

          <h1 className="font-display font-extrabold text-[38px] leading-none" style={{ color: ringColor }}>
            {correct ? 'Nailed it!' : 'Fooled!'}
          </h1>
          <p className="text-[#9AA3D0] mt-3">
            {correct
              ? `${roundResult.correctChoice} was the real photo`
              : 'That one was AI-made'}
          </p>

          {correct && roundResult.points > 0 && (
            <div className="mt-5 rounded-[16px] border-2 border-[#FFC94D]/50 bg-[#FFC94D]/10 px-6 py-2.5">
              <span className="font-display font-extrabold text-2xl text-[#FFC94D]">
                +{roundResult.points} pts
              </span>
            </div>
          )}

          {correct && streak >= 2 && (
            <div className="mt-4 rounded-full bg-white/5 px-4 py-2">
              <span className="font-body font-semibold text-sm text-[#FFF8F0]">
                🔥 {streak} in a row — keep it up
              </span>
            </div>
          )}

          <p className="font-body text-sm text-[#6E77A8] mt-8 animate-pulse">
            Waiting for the next round…
          </p>
        </div>
      </GameLayout>
    )
  }

  const Header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{playerEmoji}</span>
        <div className="text-left">
          <p className="font-display font-bold text-[#FFF8F0] leading-tight">{playerName}</p>
          <p className="font-body text-xs text-[#9AA3D0]">
            Round {currentRoundIndex + 1} of {totalRounds}
          </p>
        </div>
      </div>
      <span className="rounded-full bg-[#FFC94D]/15 px-3 py-1.5 font-display font-bold text-sm text-[#FFC94D]">
        ⭐ {myScore}
      </span>
    </div>
  )

  // Voting (2a) / locked-in
  return (
    <GameLayout>
      <div className="max-w-sm mx-auto flex flex-col items-center gap-6">
        {Header}

        <AnimatePresence mode="wait">
          {!hasVoted ? (
            <motion.div
              key="vote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-5"
            >
              <CountdownRing value={timeRemaining} total={timeLimit} size={120} showCaption />

              <div className="text-center">
                <h2 className="font-display font-extrabold text-2xl text-[#FFF8F0]">Which one's real?</h2>
                <p className="text-[#9AA3D0] text-sm mt-1">
                  Look at the big screen — faster answers score more
                </p>
              </div>

              <button
                onClick={() => handleVote('A')}
                className="w-full h-[104px] rounded-[18px] bg-[#FF8552] text-[#151936] font-display font-extrabold text-5xl -rotate-1 shadow-[0_6px_0_#C25327] active:translate-y-[3px] active:shadow-[0_3px_0_#C25327] transition-all"
              >
                A
              </button>
              <button
                onClick={() => handleVote('B')}
                className="w-full h-[104px] rounded-[18px] bg-[#57E6D2] text-[#151936] font-display font-extrabold text-5xl rotate-1 shadow-[0_6px_0_#2FA391] active:translate-y-[3px] active:shadow-[0_3px_0_#2FA391] transition-all"
              >
                B
              </button>

              {/* Speed bonus bar */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-body text-sm text-[#9AA3D0]">Speed bonus</span>
                  <span className="font-display font-bold text-sm text-[#FFC94D]">
                    +{potentialPoints} pts if you tap now
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-linear"
                    style={{
                      width: `${timeFraction * 100}%`,
                      background: 'linear-gradient(90deg, #FFC94D, #FF8552)',
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="locked"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full"
            >
              <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-10 text-center space-y-4">
                <div
                  className={`font-display font-extrabold text-7xl ${
                    voteChoice === 'A' ? 'text-[#FF8552]' : 'text-[#57E6D2]'
                  }`}
                >
                  {voteChoice}
                </div>
                <h2 className="font-display font-extrabold text-2xl text-[#FFF8F0]">Locked in!</h2>
                <p className="font-body text-sm text-[#9AA3D0]">
                  You picked {voteChoice}. Watch the big screen…
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
