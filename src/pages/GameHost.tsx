import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowRight, NameBlock, ReplayIcon, Wordmark } from '@/components/Brand'
import CountdownRing from '@/components/CountdownRing'
import { supabase } from '@/lib/supabase'
import { Users, UserX, X, Loader2 } from 'lucide-react'
import { PartyRoomProvider, hostGuestKey, usePartyRoom } from '@/hooks/usePartyRoom'
import { correctChoiceOf, type RoundData } from '@/lib/partyRoom'

const GameHostContent: React.FC<{ code: string }> = ({ code }) => {
  const navigate = useNavigate()
  // The countdown belongs to one round, so a fresh round never sees the last one's 0.
  const [timer, setTimer] = useState<{ roundId: string | null; left: number }>({ roundId: null, left: 0 })
  const timeLeft = timer.left
  const [showPlayersModal, setShowPlayersModal] = useState(false)
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const initRunningRef = useRef(false)

  const { state, online, me, status, send } = usePartyRoom()
  const isHost = !!state && !!me && state.hostId === me

  const roundsStorage = state?.rounds ?? null
  const currentRoundIndex = state?.roundIndex ?? 0
  const gameStatus = state?.status
  const settings = state?.settings ?? null
  const storedPlayers = state?.players ?? null
  const bossPlayerId = state?.bossId ?? null
  const showResult = state?.revealed ?? false

  const currentRound: RoundData | null = roundsStorage?.[currentRoundIndex] ?? null

  const votes = useMemo(() => {
    const map: Record<string, 'A' | 'B'> = {}
    for (const [pid, v] of Object.entries(state?.votes ?? {})) map[pid] = v.choice
    return map
  }, [state?.votes])

  const players = useMemo(() => {
    if (!state) return []
    return state.players
      .map((p) => ({ ...p, score: state.scores[p.id] ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [state?.players, state?.scores])

  const fetchReplacementImage = async (): Promise<RoundData | null> => {
    const { data: files } = await supabase.storage.from('real-vs-ai').list('real')
    if (!files) return null

    const validFiles = files.filter(
      (f) => !f.name.startsWith('.') && f.name !== '.emptyFolderPlaceholder',
    )

    const usedNames = new Set(
      (roundsStorage ?? []).map((r) => r.realImageUrl.split('/real/').pop() ?? ''),
    )
    const available = validFiles.filter((f) => !usedNames.has(f.name))
    const pool = available.length > 0 ? available : validFiles

    const file = pool[Math.floor(Math.random() * pool.length)]
    return {
      id: crypto.randomUUID(),
      realImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data
        .publicUrl,
      aiImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data
        .publicUrl,
    }
  }

  const handleSkipPicture = async () => {
    setIsReplacing(true)
    const round = currentRoundIndex
    const newRound = await fetchReplacementImage()
    if (newRound) send({ type: 'swap', round, data: newRound })
    setIsReplacing(false)
  }

  const generateRoundsAsync = async (count: number): Promise<RoundData[]> => {
    const { data: files } = await supabase.storage.from('real-vs-ai').list('real')

    if (files && files.length > 0) {
      const validFiles = files.filter(
        (f) => f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'),
      )

      const today = new Date().toISOString().split('T')[0]
      const history = JSON.parse(
        localStorage.getItem('real_vs_ai_shown_images') || '{"date": "", "images": []}',
      )

      let availableFiles = validFiles
      if (history.date === today) {
        availableFiles = validFiles.filter((f) => !history.images.includes(f.name))
      }

      if (availableFiles.length < count) {
        availableFiles = validFiles
      }

      const shuffled = availableFiles.sort(() => 0.5 - Math.random())
      const selected = []
      for (let i = 0; i < count; i++) {
        selected.push(shuffled[i % shuffled.length])
      }

      let hist = history
      if (hist.date !== today) hist = { date: today, images: [] }
      hist.images = [...new Set([...hist.images, ...selected.map((f) => f.name)])]
      localStorage.setItem('real_vs_ai_shown_images', JSON.stringify(hist))

      return selected.map((file) => ({
        id: crypto.randomUUID(),
        realImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data
          .publicUrl,
        aiImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data
          .publicUrl,
      }))
    }
    return Array.from({ length: count }).map((_, i) => ({
      id: crypto.randomUUID(),
      realImageUrl: `https://picsum.photos/seed/real${i}/800/600`,
      aiImageUrl: `https://picsum.photos/seed/ai${i}/800/600?blur=2`,
    }))
  }

  // The game has started (here or from the boss's phone) but has no pairs yet:
  // this screen picks them and hands them to the room.
  const needsRounds = isHost && status === 'connected' && gameStatus === 'playing' && roundsStorage?.length === 0
  useEffect(() => {
    if (!needsRounds || !settings || initRunningRef.current) return
    initRunningRef.current = true
    generateRoundsAsync(settings.rounds)
      .then((rounds) => send({ type: 'setRounds', rounds }))
      .finally(() => {
        initRunningRef.current = false
      })
  }, [needsRounds])

  // Back in the lobby state (a reload after "Play again"): go to the lobby.
  useEffect(() => {
    if (isHost && gameStatus === 'waiting') {
      navigate(`/lobby/${code}`, { state: settings ?? undefined, replace: true })
    }
  }, [isHost, gameStatus])

  const prevRoundIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentRound || currentRound.id === prevRoundIdRef.current) return
    prevRoundIdRef.current = currentRound.id
    setTimer({ roundId: currentRound.id, left: settings?.timeLimit ?? 15 })
    preloadNextRound(currentRoundIndex + 1)
  }, [currentRound?.id])

  // Everyone still connected has voted (the server also checks this on each vote).
  useEffect(() => {
    if (!state || showResult || !currentRound) return
    const present = state.players.filter((p) => online.has(p.id) || state.votes[p.id])
    if (present.length > 0 && present.every((p) => state.votes[p.id])) {
      const timeout = setTimeout(() => revealResultRef.current(), 500)
      return () => clearTimeout(timeout)
    }
  }, [state, online, showResult, currentRound])

  const timerIsLive = !!currentRound && timer.roundId === currentRound.id
  useEffect(() => {
    if (!timerIsLive || showResult) return
    if (timeLeft > 0) {
      const interval = setInterval(() => setTimer((t) => ({ ...t, left: Math.max(0, t.left - 1) })), 1000)
      return () => clearInterval(interval)
    }
    // Re-runs on reconnect, so a reveal sent while the socket was down is retried.
    revealResultRef.current()
  }, [timeLeft, showResult, timerIsLive, status])

  const revealResultRef = useRef<() => void>(() => {})
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') revealResultRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // History save when the game ends.
  useEffect(() => {
    if (gameStatus !== 'finished') return
    if (players.length > 0) {
      const history = JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]')
      if (!history.some((h: { gameId: string }) => h.gameId === code)) {
        history.push({ date: new Date().toISOString(), gameId: code, players })
        localStorage.setItem('real_vs_ai_history', JSON.stringify(history))
      }
    }
  }, [gameStatus])

  const preloadNextRound = (nextIndex: number) => {
    const nextRound = roundsStorage?.[nextIndex]
    if (nextRound) {
      const img1 = new Image()
      img1.src = nextRound.realImageUrl
      const img2 = new Image()
      img2.src = nextRound.aiImageUrl
    }
  }

  // The server scores the round from its own clock; carrying the round index makes
  // a repeat (timer + Space + all-voted) harmless.
  const revealResult = () => {
    if (showResult || !currentRound) return
    send({ type: 'reveal', round: currentRoundIndex })
  }

  revealResultRef.current = revealResult

  const handleKickPlayer = (id: string) => {
    send({ type: 'kick', playerId: id })
    setConfirmKickId(null)
  }

  const nextRound = () => send({ type: 'next', round: currentRoundIndex })

  if (state && me && state.hostId && !isHost) {
    return (
      <main className="min-h-dvh bg-side-a text-ink px-6 md:px-14 py-10 flex flex-col justify-center gap-8">
        <span className="type-label text-[clamp(14px,1.3vw,20px)]">Party code {code}</span>
        <h1 className="type-display text-[clamp(44px,6vw,96px)] leading-[0.9]">Another screen is hosting this party.</h1>
        <div>
          <Button variant="ink" size="lg" onClick={() => navigate('/')}>
            Back home <ArrowRight />
          </Button>
        </div>
      </main>
    )
  }

  // Loading state
  if (!gameStatus || !currentRound) {
    return (
      <main className="h-dvh grid grid-cols-2">
        <div className="bg-side-a text-ink flex items-center justify-end px-14">
          <span className="type-display text-[clamp(40px,5vw,76px)] leading-none">Setting up</span>
        </div>
        <div className="bg-side-b text-paper flex items-center gap-6 px-14">
          <span className="type-display text-[clamp(40px,5vw,76px)] leading-none">the party</span>
          <Loader2 className="size-12 animate-spin" strokeWidth={3} aria-label="Loading" />
        </div>
      </main>
    )
  }

  // Game over: final standings
  if (gameStatus === 'finished') {
    const winner = players[0]
    const rest = players.slice(1, 9)
    const { totalVotes, wrongVotes } = state?.stats ?? { totalVotes: 0, wrongVotes: 0 }
    const fooledPct = totalVotes > 0 ? Math.round((wrongVotes / totalVotes) * 100) : null
    const winnerName = (winner?.name ?? 'Nobody').toUpperCase()
    // Fit names up to 12 characters across the orange field.
    const winnerSize = `clamp(72px, ${Math.min(13, 62 / Math.max(winnerName.length, 4))}vw, 200px)`

    return (
      <main className="min-h-dvh lg:h-dvh grid grid-cols-1 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] grid-rows-[auto_auto_auto] lg:grid-rows-[minmax(0,1fr)_112px] overflow-hidden">
        <section className="bg-side-a text-ink px-6 md:px-14 pt-10 pb-11 flex flex-col justify-between gap-10 min-w-0">
          <div className="flex justify-between type-label text-[clamp(14px,1.3vw,20px)]">
            <span>Real or AI · Final</span>
            <span>Winner</span>
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            <h1 className="type-display leading-[0.8] tracking-[-0.04em] break-words" style={{ fontSize: winnerSize }}>
              {winnerName}
            </h1>
            <span className="type-display text-[clamp(44px,5.5vw,88px)] leading-[0.9]">
              {winner ? 'Takes it.' : 'No winner.'}
            </span>
          </div>
          {winner && (
            <div className="flex items-baseline gap-5">
              <span className="type-display text-[clamp(44px,4.5vw,72px)] leading-none tabular-nums">
                {winner.score}
              </span>
              <span className="type-label text-[clamp(16px,1.4vw,22px)]">Points</span>
            </div>
          )}
        </section>

        <section className="bg-side-b text-paper px-6 md:px-12 pt-10 pb-8 flex flex-col gap-3.5 min-h-0 on-dark">
          <span className="type-label text-[clamp(14px,1.3vw,20px)]">Standings</span>
          <ol className="flex flex-col overflow-y-auto">
            {rest.map((p, i) => {
              const big = i < 2
              return (
                <li
                  key={p.id}
                  className={`flex items-baseline gap-[18px] border-b-2 border-side-b-line ${big ? 'py-3.5' : 'py-2.5'}`}
                >
                  <span
                    className={`type-display leading-none w-12 ${big ? 'text-[clamp(30px,2.8vw,44px)]' : 'text-[clamp(20px,1.6vw,26px)]'}`}
                  >
                    {i + 2}
                  </span>
                  <span
                    className={`type-name leading-none truncate ${big ? 'text-[clamp(30px,2.8vw,44px)]' : 'text-[clamp(20px,1.6vw,26px)]'}`}
                  >
                    {p.name}
                  </span>
                  <span className="ml-auto type-label text-lg tabular-nums shrink-0">{p.score} pts</span>
                </li>
              )
            })}
            {rest.length === 0 && (
              <li className="font-medium text-lg text-on-blue-muted py-3">Only one player this time.</li>
            )}
          </ol>
        </section>

        <footer className="lg:col-span-2 bg-ink text-paper flex flex-col sm:flex-row sm:items-center on-dark">
          <span className="flex-1 type-label text-[clamp(16px,1.3vw,20px)] px-6 md:px-14 py-6 sm:py-0">
            {settings?.rounds ?? roundsStorage?.length ?? 0} rounds · {players.length} {players.length === 1 ? 'player' : 'players'}
            {fooledPct !== null && (
              <>
                {' · '}
                <span className="text-side-a">{fooledPct}% fooled by the AI</span>
              </>
            )}
          </span>
          <Button variant="paper" className="h-[112px] px-10 text-[28px] rounded-none" onClick={() => navigate('/')}>
            Back home
          </Button>
          <Button
            className="h-[112px] px-11 text-[28px]"
            onClick={() => {
              send({ type: 'rematch' })
              navigate(`/lobby/${code}`, {
                state: {
                  rounds: settings?.rounds ?? 10,
                  timeLimit: settings?.timeLimit ?? 15,
                  revealMode: settings?.revealMode ?? 'instant',
                },
              })
            }}
          >
            Play again <ReplayIcon />
          </Button>
        </footer>
        {/* Results screen - banner allowed. Popunder is player-device only, not
            fired on this shared host display. */}
      </main>
    )
  }

  const correctChoice = correctChoiceOf(currentRound)
  const isRealLeft = correctChoice === 'A'
  const leftImage = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const rightImage = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl

  const totalPlayers = storedPlayers?.length ?? 0
  const votedCount = Object.keys(votes).length
  const correctCount = Object.values(votes).filter((v) => v === correctChoice).length
  const totalRounds = roundsStorage?.length ?? settings?.rounds ?? 0

  const playerLookup = new Map(
    (storedPlayers ?? []).map((p) => [p.id, { ...p, score: state?.scores[p.id] ?? 0 }]),
  )

  const liveVotesVisible = settings?.revealMode === 'instant'
  const bossName = bossPlayerId ? (playerLookup.get(bossPlayerId)?.name ?? null) : null
  const votersFor = (side: 'A' | 'B') =>
    Object.entries(votes)
      .filter(([, choice]) => choice === side)
      .map(([pid]) => playerLookup.get(pid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const ManagePlayers = (
    <Dialog open={showPlayersModal} onOpenChange={setShowPlayersModal}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Manage players" className="text-paper">
          <Users strokeWidth={2.5} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Players</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col border-t-4 border-ink">
          {players.length === 0 && (
            <li className="font-medium text-text-muted py-4">No players yet.</li>
          )}
          {players.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-b-2 border-ink py-2.5">
              <div className="flex flex-col min-w-0">
                <span className="type-name text-xl truncate">{p.name}</span>
                <span className="type-label text-sm text-text-muted">{p.score} pts</span>
              </div>
              {confirmKickId === p.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ink" size="sm" onClick={() => handleKickPlayer(p.id)}>
                    Remove
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    aria-label="Keep player"
                    onClick={() => setConfirmKickId(null)}
                  >
                    <X strokeWidth={3} />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setConfirmKickId(p.id)}
                >
                  <UserX strokeWidth={2.5} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )

  // Round and reveal share one tree, so the split can slide from 50/50 to 70/30.
  const revealed = showResult
  const aWins = correctChoice === 'A'
  const growA = revealed ? (aWins ? 7 : 3) : 1
  const growB = revealed ? (aWins ? 3 : 7) : 1
  const fieldA = revealed && !aWins ? 'bg-side-a-tint' : 'bg-side-a'
  const fieldB = revealed && aWins ? 'bg-side-b-deep' : 'bg-side-b'
  const fieldPad = 'px-[clamp(20px,3.5vw,56px)] pt-[clamp(20px,2.5vw,40px)] pb-[clamp(16px,2vw,32px)]'
  const verdictSize = 'text-[clamp(48px,6.5vw,104px)] leading-[0.9] tracking-[-0.03em]'
  const loserSize = 'text-[clamp(32px,3.5vw,56px)] leading-[0.95]'
  const headlineSize = 'text-[clamp(40px,4.75vw,76px)] leading-[0.95] tracking-[-0.02em]'
  const letterSize = 'text-[clamp(90px,9.4vw,150px)] leading-[0.78]'

  const voteMeta = (side: 'A' | 'B') => {
    const n = Object.values(votes).filter((v) => v === side).length
    if (revealed) {
      const real = side === correctChoice
      return real ? `${n} got it` : `${n} fooled`
    }
    return liveVotesVisible ? `${n} ${n === 1 ? 'vote' : 'votes'}` : ''
  }

  const VoterRow: React.FC<{ side: 'A' | 'B'; onBlue: boolean }> = ({ side, onBlue }) => {
    if (!revealed && !liveVotesVisible) return null
    const voters = votersFor(side)
    if (voters.length === 0) return null
    return (
      <ul className={`flex flex-wrap gap-2 ${side === 'A' ? 'justify-end' : 'justify-start'}`}>
        {voters.slice(0, 10).map((p) => (
          <li key={p.id}>
            <NameBlock name={p.name} tone={onBlue ? 'paper' : 'ink'} small />
          </li>
        ))}
        {voters.length > 10 && (
          <li className="type-label text-lg self-center">+{voters.length - 10}</li>
        )}
      </ul>
    )
  }

  return (
    <main className="h-dvh flex flex-col overflow-hidden">
      <div className="flex-1 flex min-h-0 relative">
        {/* A */}
        <section
          className={`split-field ${fieldA} text-ink ${fieldPad} flex flex-col items-end gap-[clamp(12px,1.6vw,24px)] overflow-hidden`}
          style={{ flexGrow: growA, flexBasis: 0 }}
        >
          <div className="w-full flex justify-between type-label text-[clamp(14px,1.3vw,20px)]">
            <Wordmark className="text-[clamp(14px,1.3vw,20px)] tracking-[0.02em]" />
            <span>
              Round {currentRoundIndex + 1}/{totalRounds}
              {revealed ? ' · The verdict' : ''}
            </span>
          </div>
          <h1 className={`type-display text-right ${revealed ? (aWins ? verdictSize : loserSize) : headlineSize}`}>
            {revealed ? (aWins ? 'A was real.' : 'AI-made.') : (
              <>
                Which one's
                <span className="sr-only"> real?</span>
              </>
            )}
          </h1>
          <div className="flex-1 min-h-0 w-full flex justify-end">
            <img
              src={leftImage}
              alt="Photo A"
              className={`max-h-full max-w-full object-contain transition-opacity duration-500 ${revealed && !aWins ? 'opacity-60' : ''}`}
            />
          </div>
          <div className="w-full flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <span className="type-label text-[clamp(14px,1.3vw,20px)]">{voteMeta('A')}</span>
              <VoterRow side="A" onBlue={false} />
            </div>
            <span className={`type-display ${letterSize}`} aria-hidden="true">
              A
            </span>
          </div>
        </section>

        {/* B */}
        <section
          className={`split-field ${fieldB} text-paper on-dark ${fieldPad} flex flex-col items-start gap-[clamp(12px,1.6vw,24px)] overflow-hidden`}
          style={{ flexGrow: growB, flexBasis: 0 }}
        >
          <div className="w-full flex justify-between type-label text-[clamp(14px,1.3vw,20px)]">
            <span>
              {revealed ? `${correctCount} of ${totalPlayers} got it` : `${votedCount} of ${totalPlayers} voted`}
            </span>
            <span>{liveVotesVisible ? 'Live votes' : 'Votes after the round'}</span>
          </div>
          <span
            aria-hidden={!revealed}
            className={`type-display ${revealed ? (aWins ? loserSize : verdictSize) : headlineSize}`}
          >
            {revealed ? (aWins ? 'AI-made.' : 'B was real.') : 'Real?'}
          </span>
          <div className="flex-1 min-h-0 w-full flex justify-start">
            <img
              src={rightImage}
              alt="Photo B"
              className={`max-h-full max-w-full object-contain transition-opacity duration-500 ${revealed && aWins ? 'opacity-60' : ''}`}
            />
          </div>
          <div className="w-full flex items-end justify-between gap-4">
            <span className={`type-display ${letterSize}`} aria-hidden="true">
              B
            </span>
            <div className="flex flex-col items-end gap-2 min-w-0">
              <span className="type-label text-[clamp(14px,1.3vw,20px)]">{voteMeta('B')}</span>
              <VoterRow side="B" onBlue />
            </div>
          </div>
        </section>

        {!revealed && (
          <CountdownRing
            value={timeLeft}
            total={settings?.timeLimit ?? 15}
            size={156}
            caption="SEC"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none max-lg:scale-75"
          />
        )}
      </div>

      {/* Ink band: host controls during the round, standings on the reveal */}
      <footer className="h-[112px] shrink-0 bg-ink text-paper flex items-center on-dark">
        {revealed ? (
          <>
            <ol className="flex-1 grid grid-cols-3 lg:grid-cols-5 gap-4 px-[clamp(20px,3.5vw,56px)] min-w-0">
              {players.slice(0, 5).map((p, i) => (
                <li key={p.id} className={`flex items-baseline gap-3.5 min-w-0 ${i > 2 ? 'max-lg:hidden' : ''}`}>
                  <span className={`type-display text-[34px] leading-none ${i === 0 ? 'text-side-a' : ''}`}>{i + 1}</span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="type-name text-2xl leading-none truncate">{p.name}</span>
                    <span className="font-semibold text-base text-on-ink-muted tabular-nums">{p.score} pts</span>
                  </span>
                </li>
              ))}
            </ol>
            {bossName && (
              <span className="hidden xl:block type-label text-sm text-on-ink-muted px-4 max-w-[220px]">
                {bossName} can move on too
              </span>
            )}
            <Button className="h-[112px] px-11 text-[clamp(22px,2vw,30px)]" onClick={nextRound}>
              {currentRoundIndex + 1 >= totalRounds ? 'See results' : 'Next round'} <ArrowRight />
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-6 px-[clamp(20px,3.5vw,56px)] min-w-0">
              <div className="flex gap-1.5" aria-label={`Round ${currentRoundIndex + 1} of ${totalRounds}`}>
                {Array.from({ length: totalRounds }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-3 w-3 ${
                      idx < currentRoundIndex
                        ? 'bg-paper'
                        : idx === currentRoundIndex
                          ? 'bg-side-a'
                          : 'border-2 border-on-ink-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="type-label text-[clamp(14px,1.3vw,20px)] truncate">
                {bossName ? `${bossName} is the boss` : 'Space reveals early'}
              </span>
            </div>
            <div className="flex items-center gap-3 pr-[clamp(20px,3.5vw,56px)]">
              {ManagePlayers}
              <Button variant="outline" className="text-paper h-12 text-base px-4" onClick={handleSkipPicture} disabled={isReplacing}>
                {isReplacing ? <Loader2 className="animate-spin" /> : <ReplayIcon />}
                Swap pair
              </Button>
              {settings?.revealMode === 'after_round' && (
                <Button className="h-12 text-base px-5" onClick={() => revealResult()}>
                  Reveal
                </Button>
              )}
            </div>
          </>
        )}
      </footer>
      {/* No banner on the active round view - never advertise during answering. */}
    </main>
  )
}

const GameHost: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const [hostKey] = useState(hostGuestKey)

  if (!code) return null

  return (
    <PartyRoomProvider code={code} guestKey={hostKey}>
      <GameHostContent code={code} />
    </PartyRoomProvider>
  )
}

export default GameHost
