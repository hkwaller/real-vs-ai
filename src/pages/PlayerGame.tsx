// Future monetization boundary: only after the entire session has completed and final results are visible.
// Consult playam-monetization.monetizationBreakReached; no ad SDK or event is invoked here.
import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, NO_EMOJI } from '@/components/Brand'
import CountdownRing from '@/components/CountdownRing'
import {
  RoomProvider,
  useStorage,
  useMutation,
  useUpdateMyPresence,
  useEventListener,
  useBroadcastEvent,
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
  const { code } = useParams<{ code: string }>()
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
  const bossPlayerId = useStorage((root) => root.bossPlayerId ?? null)

  // The boss drives the game from their own device; the host display obeys.
  const broadcast = useBroadcastEvent()
  const isBoss = bossPlayerId !== null && bossPlayerId === playerId
  const [bossCommandSent, setBossCommandSent] = useState(false)

  const sendBossCommand = (type: 'BOSS_START' | 'BOSS_REVEAL' | 'BOSS_NEXT_ROUND') => {
    if (!isBoss) return
    setBossCommandSent(true)
    broadcast({ type, playerId })
  }

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

  // Countdown - resets when round changes
  useEffect(() => {
    roundStartTimeRef.current = Date.now()
    setTimeRemaining(timeLimit)
    setHasVoted(false)
    setVoteChoice(null)
    voteChoiceRef.current = null
    setRoundResult(null)
    setBossCommandSent(false)
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
  const myScore = scoresMap?.get(playerId) ?? 0

  const upperName = playerName.toUpperCase()
  const metaLine = `${upperName} · ${myScore} PTS`
  const roundLine = `ROUND ${currentRoundIndex + 1}/${totalRounds}`

  // Game over
  if (gameStatus === 'finished') {
    return (
      <main className="screen-phone bg-ink text-paper on-dark">
        <div className="flex justify-between px-6 pt-6 type-label text-[15px]">
          <span>{metaLine}</span>
          <span>Final</span>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-5 px-6">
          <h1 className="type-display text-[56px] leading-[0.9]">That's a wrap.</h1>
          <p className="font-semibold text-lg leading-snug text-on-ink-muted">
            The final standings are on the big screen.
          </p>
        </div>
        <Button variant="paper" size="bar" onClick={() => navigate('/')}>
          Back home <ArrowRight />
        </Button>
      </main>
    )
  }

  // Waiting room
  if (gameStatus !== 'playing' || !currentRound) {
    return (
      <main className="screen-phone bg-side-b text-paper on-dark">
        <div className="flex justify-between px-6 pt-6 type-label text-[15px]">
          <span>Real or AI · {code}</span>
          {isBoss && <span className="bg-side-a text-ink px-2 py-1">Boss</span>}
        </div>
        <div className="flex-1 flex flex-col justify-center gap-5 px-6">
          <h1 className="type-display text-[56px] leading-[0.9] break-words">
            You're in,
            <br />
            {upperName}.
          </h1>
          <p className="font-medium text-lg leading-snug text-on-blue-muted">
            {isBoss
              ? 'You run this game. Start it when everyone has joined.'
              : 'Eyes on the TV. The first pair shows up as soon as the game starts.'}
          </p>
          {!isBoss && (
            <div className="flex gap-2 mt-2" aria-hidden="true">
              <span className="w-[18px] h-[18px] bg-paper animate-pulse" />
              <span className="w-[18px] h-[18px] bg-paper animate-pulse [animation-delay:200ms]" />
              <span className="w-[18px] h-[18px] bg-paper animate-pulse [animation-delay:400ms]" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/join')}
          className="self-start mx-6 py-3.5 type-label text-[15px] underline underline-offset-4"
        >
          Wrong code? Go back
        </button>
        {isBoss ? (
          <Button
            size="bar"
            className="h-[120px]"
            onClick={() => sendBossCommand('BOSS_START')}
            disabled={bossCommandSent}
          >
            {bossCommandSent ? 'Starting…' : 'Start the game'} <ArrowRight />
          </Button>
        ) : (
          <div className="h-[120px] bg-ink text-paper flex items-center px-6 type-label text-[15px] pad-bottom-safe">
            Waiting for the host to start
          </div>
        )}
      </main>
    )
  }

  // Round result
  if (roundResult) {
    const { correct, didVote, correctChoice, points } = roundResult
    const realIsA = correctChoice === 'A'
    const realBlock = realIsA ? 'bg-side-a text-ink' : 'bg-side-b text-paper on-dark'
    const ground = correct ? 'bg-paper text-ink' : 'bg-ink text-paper on-dark'
    return (
      <main className={`screen-phone ${ground}`}>
        <div className="flex justify-between px-6 pt-6 type-label text-[15px]">
          <span>{metaLine}</span>
          <span>{roundLine}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-4 px-6">
          {correct ? (
            <>
              <h1 className="type-display text-[48px] leading-[0.95]">
                You
                <br />
                got it.
              </h1>
              <span className="type-display text-[clamp(110px,38vw,150px)] leading-[0.8] tracking-[-0.04em] text-side-a">
                +{points}
              </span>
              {streak >= 2 && <span className="type-label text-lg">{streak} in a row</span>}
            </>
          ) : (
            <>
              <h1 className="type-display text-[clamp(44px,15vw,64px)] leading-[0.9]">
                {didVote ? 'Fooled.' : 'Too slow.'}
              </h1>
              <p className="font-semibold text-xl leading-snug text-on-ink-muted">
                {didVote
                  ? `You picked the fake. ${correctChoice} was the real photo.`
                  : `No vote this round. ${correctChoice} was the real photo.`}
              </p>
              <span className="type-label text-lg">
                0 pts{didVote ? ' · streak reset' : ''}
              </span>
            </>
          )}
        </div>
        <div className={`${realBlock} h-[168px] flex items-center justify-between px-6 shrink-0`}>
          <span className="type-display text-[30px] leading-none">
            {correctChoice} was
            <br />
            real
          </span>
          <span className="type-display text-[150px] leading-[0.75]" aria-hidden="true">
            {correctChoice}
          </span>
        </div>
        {isBoss ? (
          <Button
            size="bar"
            variant={realIsA ? 'ink' : 'default'}
            onClick={() => sendBossCommand('BOSS_NEXT_ROUND')}
            disabled={bossCommandSent}
          >
            {bossCommandSent ? 'Loading…' : 'Next round'} <ArrowRight />
          </Button>
        ) : (
          <div className="bg-ink text-paper px-6 pt-5 type-label text-[15px] pad-bottom-safe">
            {currentRoundIndex + 1 >= totalRounds ? 'Results in a moment' : 'Next round in a moment'}
          </div>
        )}
      </main>
    )
  }

  // Locked in
  if (hasVoted && voteChoice) {
    const isA = voteChoice === 'A'
    return (
      <main className={`screen-phone ${isA ? 'bg-side-a text-ink' : 'bg-side-b text-paper on-dark'}`}>
        <div className="flex justify-between px-6 pt-6 type-label text-[15px]">
          <span>{metaLine}</span>
          <span>{roundLine}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-3 px-6">
          <span className="type-display text-[clamp(240px,85vw,340px)] leading-[0.74] tracking-[-0.04em] -ml-2.5" aria-hidden="true">
            {voteChoice}
          </span>
          <h1 className="type-display text-[52px] leading-[0.9] mt-6">Locked in.</h1>
          <p className="font-semibold text-lg leading-snug">You picked {voteChoice}. Eyes on the TV.</p>
        </div>
        {isBoss ? (
          <Button
            variant="ink"
            size="bar"
            onClick={() => sendBossCommand('BOSS_REVEAL')}
            disabled={bossCommandSent}
          >
            {bossCommandSent ? 'Revealing…' : 'Reveal now'}
            <span className="type-label text-sm text-side-a">Boss</span>
          </Button>
        ) : (
          <div className="h-[112px] bg-ink text-paper flex items-center justify-between px-6 pad-bottom-safe">
            <span className="type-label text-[17px]">Waiting for the reveal</span>
            <span className="type-display text-[30px] tabular-nums">0:{String(timeRemaining).padStart(2, '0')}</span>
          </div>
        )}
      </main>
    )
  }

  // Voting: the whole screen is the two buttons
  return (
    <main className="h-dvh flex flex-col relative overflow-hidden">
      <button
        type="button"
        onClick={() => handleVote('A')}
        aria-label="Vote A"
        className="flex-1 bg-side-a text-ink flex flex-col justify-between px-6 pb-7 text-left active:brightness-[0.88]"
        style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 0px))' }}
      >
        <span className="flex flex-col gap-4 w-full">
          <span className="flex justify-between w-full type-label text-[15px]">
            <span>
              {metaLine}
              {isBoss ? ' · BOSS' : ''}
            </span>
            <span>{roundLine}</span>
          </span>
          <span className="type-display text-[30px] leading-[0.95]">Which one's real?</span>
        </span>
        <span className="type-display self-end text-[clamp(150px,50vw,220px)] leading-[0.74] tracking-[-0.04em]">
          A
        </span>
      </button>
      <button
        type="button"
        onClick={() => handleVote('B')}
        aria-label="Vote B"
        className="flex-1 bg-side-b text-paper flex flex-col justify-between px-6 pt-7 text-left active:brightness-[0.88] on-dark"
        style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))' }}
      >
        <span className="type-display text-[clamp(150px,50vw,220px)] leading-[0.74] tracking-[-0.04em]">B</span>
        <span className="type-label text-[15px] self-end">Faster scores more</span>
      </button>
      <CountdownRing
        value={timeRemaining}
        total={timeLimit}
        size={118}
        caption={`+${potentialPoints} PTS`}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      />
    </main>
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
  const playerEmoji = playerData?.emoji ?? NO_EMOJI

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
        hostAdFree: false,
        bossPlayerId: null,
      }}
    >
      <PlayerGameContent playerId={playerId} playerName={playerName} playerEmoji={playerEmoji} />
    </RoomProvider>
  )
}

export default PlayerGame
