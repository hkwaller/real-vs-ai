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
import { ArrowRight, NameBlock, NO_EMOJI, ReplayIcon, Wordmark } from '@/components/Brand'
import CountdownRing from '@/components/CountdownRing'
import { supabase } from '@/lib/supabase'
import { Users, UserX, X, Loader2 } from 'lucide-react'
import {
  RoomProvider,
  useOthers,
  useStorage,
  useMutation,
  useBroadcastEvent,
  useEventListener,
  useStatus,
  LiveList,
  LiveMap,
  LiveObject,
} from '@/liveblocks.config'

type RoundData = { id: string; realImageUrl: string; aiImageUrl: string }

const GameHostContent: React.FC<{ code: string }> = ({ code }) => {
  const navigate = useNavigate()
  const [timeLeft, setTimeLeft] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const initRunningRef = useRef(false)
  const [showPlayersModal, setShowPlayersModal] = useState(false)
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)

  // In-game ads: hidden if the host started the game ad-free (host perk) or if
  // this viewer is ad-free. The banner also self-gates on the local entitlement.

  const status = useStatus()

  const roundsStorage = useStorage((root) => root.rounds)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const gameStatusObj = useStorage((root) => root.gameStatus)
  const settingsObj = useStorage((root) => root.settings)
  const storedPlayers = useStorage((root) => root.players)
  const scores = useStorage((root) => root.scores)
  const bossPlayerId = useStorage((root) => root.bossPlayerId ?? null)

  const others = useOthers()
  const broadcast = useBroadcastEvent()

  // Rank of each player entering the current round (for ▲/▼ carets on reveal).
  const prevRanksRef = useRef<Record<string, number>>({})
  // Game-wide "fooled by the AI" tally.
  const gameStatsRef = useRef({ totalVotes: 0, wrongVotes: 0 })

  const currentRoundIndex = currentRoundIndexObj?.value ?? 0
  const gameStatus = gameStatusObj?.value
  const settings = settingsObj
    ? {
        rounds: settingsObj.rounds,
        timeLimit: settingsObj.timeLimit,
        revealMode: settingsObj.revealMode,
      }
    : null

  const currentRound: RoundData | null = roundsStorage?.[currentRoundIndex] ?? null

  const votes = useMemo(() => {
    const map: Record<string, 'A' | 'B'> = {}
    others
      .filter((o) => !o.presence.isHost && o.presence.hasVoted && o.presence.currentVote)
      .forEach((o) => {
        map[o.presence.playerId] = o.presence.currentVote!
      })
    return map
  }, [others])

  const players = useMemo(() => {
    if (!storedPlayers || !scores) return []
    return [...storedPlayers]
      .map((p) => ({ ...p, score: scores.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [storedPlayers, scores])

  const storeRounds = useMutation(({ storage }, data: RoundData[]) => {
    const roundsList = storage.get('rounds')
    data.forEach((r) => roundsList.push(r))
  }, [])

  const advanceRound = useMutation(({ storage }, index: number) => {
    storage.get('currentRoundIndex').set('value', index)
  }, [])

  const updateScores = useMutation(
    ({ storage }, updates: { playerId: string; increment: number }[]) => {
      const scoreMap = storage.get('scores')
      for (const { playerId, increment } of updates) {
        if (increment > 0) {
          const current = scoreMap.get(playerId) ?? 0
          scoreMap.set(playerId, current + increment)
        }
      }
    },
    [],
  )

  const finishGame = useMutation(({ storage }) => {
    storage.get('gameStatus').set('value', 'finished')
  }, [])

  const resetGame = useMutation(({ storage }) => {
    const roundsList = storage.get('rounds')
    while (roundsList.length > 0) roundsList.delete(0)
    const scoreMap = storage.get('scores')
    const playerList = storage.get('players')
    for (let i = 0; i < playerList.length; i++) {
      const player = playerList.get(i)
      if (player) scoreMap.set(player.id, 0)
    }
    storage.get('currentRoundIndex').set('value', 0)
    storage.get('gameStatus').set('value', 'waiting')
    // Clear the host perk so a rematch re-stamps it from the host at next start.
    storage.set('hostAdFree', false)
  }, [])

  const replaceRound = useMutation(
    ({ storage }, newRound: RoundData) => {
      storage.get('rounds').set(currentRoundIndex, newRound)
    },
    [currentRoundIndex],
  )

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
    const newRound = await fetchReplacementImage()
    if (newRound) replaceRound(newRound)
    setIsReplacing(false)
  }

  const removePlayer = useMutation(({ storage }, id: string) => {
    const playerList = storage.get('players')
    const scoreMap = storage.get('scores')
    for (let i = 0; i < playerList.length; i++) {
      if (playerList.get(i)?.id === id) {
        playerList.delete(i)
        break
      }
    }
    scoreMap.delete(id)
  }, [])

  const generateRoundsAsync = async (count: number, isCancelled: () => boolean = () => false) => {
    const { data: files } = await supabase.storage.from('real-vs-ai').list('real')

    let roundsData: RoundData[]

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

      roundsData = selected.map((file) => ({
        id: crypto.randomUUID(),
        realImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data
          .publicUrl,
        aiImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data
          .publicUrl,
      }))

      const today2 = new Date().toISOString().split('T')[0]
      let hist = JSON.parse(
        localStorage.getItem('real_vs_ai_shown_images') || '{"date": "", "images": []}',
      )
      if (hist.date !== today2) hist = { date: today2, images: [] }
      const newImages = selected.map((f) => f.name)
      hist.images = [...new Set([...hist.images, ...newImages])]
      localStorage.setItem('real_vs_ai_shown_images', JSON.stringify(hist))
    } else {
      roundsData = Array.from({ length: count }).map((_, i) => ({
        id: crypto.randomUUID(),
        realImageUrl: `https://picsum.photos/seed/real${i}/800/600`,
        aiImageUrl: `https://picsum.photos/seed/ai${i}/800/600?blur=2`,
      }))
    }

    if (isCancelled()) return
    storeRounds(roundsData)
    setInitialized(true)
    setTimeLeft(settings?.timeLimit ?? 15)
  }

  useEffect(() => {
    if (
      initRunningRef.current ||
      status !== 'connected' ||
      roundsStorage === null ||
      settings === null
    )
      return

    initRunningRef.current = true
    let cancelled = false

    if (roundsStorage.length === 0) {
      generateRoundsAsync(settings.rounds, () => cancelled)
    } else {
      setInitialized(true)
      setTimeLeft(settings.timeLimit)
    }

    return () => {
      cancelled = true
      initRunningRef.current = false
    }
  }, [status, roundsStorage?.length ?? -1, settings?.rounds])

  const prevRoundIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentRound || currentRound.id === prevRoundIdRef.current) return
    prevRoundIdRef.current = currentRound.id

    setShowResult(false)
    setTimeLeft(settings?.timeLimit ?? 15)
    preloadNextRound(currentRoundIndex + 1)
  }, [currentRound?.id])

  useEffect(() => {
    const presentPlayers = others.filter((o) => !o.presence.isHost)
    const totalPlayers = presentPlayers.length
    const totalVoted = presentPlayers.filter((o) => o.presence.hasVoted).length
    if (totalPlayers > 0 && totalVoted === totalPlayers && !showResult && currentRound) {
      const timeout = setTimeout(() => revealResultRef.current(), 500)
      return () => clearTimeout(timeout)
    }
  }, [others, showResult, currentRound])

  useEffect(() => {
    if (timeLeft > 0 && !showResult) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearInterval(timer)
    } else if (timeLeft === 0 && !showResult && currentRound && initialized) {
      revealResultRef.current()
    }
  }, [timeLeft, showResult, currentRound, initialized])

  const revealResultRef = useRef<() => void>(() => {})
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') revealResultRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Confetti + history save when the game ends.
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

  const revealResult = () => {
    if (showResult) return
    setShowResult(true)
    if (!currentRound) return

    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice = isRealLeft ? 'A' : 'B'
    const tl = settings?.timeLimit ?? 15

    // Snapshot ranking before this round's points land.
    prevRanksRef.current = Object.fromEntries(players.map((p, i) => [p.id, i + 1]))

    const results = others
      .filter((o) => !o.presence.isHost && o.presence.hasVoted)
      .map((o) => {
        const choice = o.presence.currentVote
        const tr = o.presence.timeRemaining ?? 0
        const correct = choice === correctChoice
        const gracePeriod = 3
        const scoringWindow = tl - gracePeriod
        const pts = tr >= scoringWindow ? 100 : Math.round(100 * (tr / scoringWindow))
        return { playerId: o.presence.playerId, correct, increment: correct ? pts : 0 }
      })

    updateScores(results.map((r) => ({ playerId: r.playerId, increment: r.increment })))

    gameStatsRef.current.totalVotes += results.length
    gameStatsRef.current.wrongVotes += results.filter((r) => !r.correct).length

    const scoresMap: Record<string, number> = {}
    results.forEach((r) => {
      scoresMap[r.playerId] = r.increment
    })
    broadcast({ type: 'ROUND_REVEALED', correctChoice, scores: scoresMap })

  }

  revealResultRef.current = revealResult

  const handleKickPlayer = (id: string) => {
    removePlayer(id)
    broadcast({ type: 'PLAYER_KICKED', playerId: id })
    setConfirmKickId(null)
  }

  const nextRound = () => {
    const nextIndex = currentRoundIndex + 1
    if (!roundsStorage || nextIndex >= roundsStorage.length) {
      finishGame()
      broadcast({ type: 'GAME_OVER' })
    } else {
      advanceRound(nextIndex)
    }
  }

  // Boss remote control. Commands are only honoured from the player currently
  // marked as boss in storage.
  const nextRoundRef = useRef<() => void>(() => {})
  nextRoundRef.current = nextRound
  const showResultRef = useRef(showResult)
  showResultRef.current = showResult

  useEventListener(({ event }) => {
    if (event.type !== 'BOSS_REVEAL' && event.type !== 'BOSS_NEXT_ROUND') return
    if (!bossPlayerId || event.playerId !== bossPlayerId) return
    if (event.type === 'BOSS_REVEAL') revealResultRef.current()
    // Only advance from the reveal screen, so a round is never skipped unscored.
    else if (showResultRef.current) nextRoundRef.current()
  })

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
    const { totalVotes, wrongVotes } = gameStatsRef.current
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
              resetGame()
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

  const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
  const leftImage = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const rightImage = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl
  const correctChoice: 'A' | 'B' = isRealLeft ? 'A' : 'B'

  const totalPlayers = storedPlayers?.length ?? 0
  const votedCount = Object.keys(votes).length
  const correctCount = Object.values(votes).filter((v) => v === correctChoice).length
  const totalRounds = roundsStorage?.length ?? settings?.rounds ?? 0

  const playerLookup = new Map(
    (storedPlayers ?? []).map((p) => [p.id, { ...p, score: scores?.get(p.id) ?? 0 }]),
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

  if (!code) return null

  return (
    <RoomProvider
      id={code}
      initialPresence={{
        name: 'Host',
        emoji: NO_EMOJI,
        playerId: 'host',
        isHost: true,
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
      <GameHostContent code={code} />
    </RoomProvider>
  )
}

export default GameHost
