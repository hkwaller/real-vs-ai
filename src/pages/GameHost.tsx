import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth, useUser } from '@clerk/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import GameLayout from '@/components/GameLayout'
import CountdownRing from '@/components/CountdownRing'
import AdBanner from '@/components/AdBanner'
import { supabase } from '@/lib/supabase'
import { Users, UserX, X, Loader2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  RoomProvider,
  useOthers,
  useStorage,
  useMutation,
  useBroadcastEvent,
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

  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const isSubscribed =
    (user?.publicMetadata as { subscriptionStatus?: string } | undefined)?.subscriptionStatus ===
    'active'
  const showAds = !!isSignedIn && !isSubscribed

  const status = useStatus()

  const roundsStorage = useStorage((root) => root.rounds)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const gameStatusObj = useStorage((root) => root.gameStatus)
  const settingsObj = useStorage((root) => root.settings)
  const storedPlayers = useStorage((root) => root.players)
  const scores = useStorage((root) => root.scores)

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
    if (initRunningRef.current || status !== 'connected' || roundsStorage === null || settings === null) return

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
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.5 } })
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

    const correctCount = results.filter((r) => r.correct).length
    if (results.length > 0 && correctCount * 2 > results.length) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    }
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

  // Loading state
  if (!gameStatus || !currentRound) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#FF8552] animate-spin mx-auto" />
          <p className="font-body text-sm text-[#9AA3D0]">Setting up the party…</p>
        </div>
      </div>
    )
  }

  // Game over — podium
  if (gameStatus === 'finished') {
    const winner = players[0]
    const podiumRanks = [2, 1, 3]
    const podiumHeights: Record<number, number> = { 1: 160, 2: 110, 3: 80 }
    const podiumColor: Record<number, string> = {
      1: 'bg-[#FFC94D] text-[#151936]',
      2: 'bg-white/5 text-[#9AA3D0]',
      3: 'bg-white/5 text-[#9AA3D0]',
    }
    const rest = players.slice(3)
    const { totalVotes, wrongVotes } = gameStatsRef.current
    const fooledPct = totalVotes > 0 ? Math.round((wrongVotes / totalVotes) * 100) : null

    return (
      <GameLayout className="max-w-4xl">
        <div className="text-center mb-2">
          <h1 className="font-display font-extrabold text-[52px] leading-tight text-[#FFF8F0]">
            🏆 {winner ? `${winner.name} takes it!` : 'Game over!'}
          </h1>
          <p className="text-[#9AA3D0] mt-1">
            {settings?.rounds ?? players.length} rounds · {players.length} players
            {fooledPct !== null ? ` · ${fooledPct}% fooled by the AI` : ''}
          </p>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-4 mt-10 mb-8">
          {podiumRanks.map((rank) => {
            const p = players[rank - 1]
            if (!p) return <div key={rank} className="w-1/4" />
            const isWinner = rank === 1
            return (
              <div key={rank} className="flex flex-col items-center gap-2 w-1/4 max-w-[180px]">
                {isWinner && <span className="text-3xl leading-none">👑</span>}
                <span className="text-4xl leading-none">{p.emoji}</span>
                <span className="font-display font-bold text-[#FFF8F0]">{p.name}</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: podiumHeights[rank] }}
                  transition={{ delay: 0.15 * (4 - rank), type: 'spring', stiffness: 120, damping: 16 }}
                  className={`w-full rounded-t-[16px] flex flex-col items-center justify-center gap-1 ${podiumColor[rank]}`}
                  style={{ minHeight: 60 }}
                >
                  <span className="font-display font-extrabold text-3xl leading-none">{rank}</span>
                  <span className={`font-body font-semibold text-sm ${isWinner ? 'text-[#151936]/70' : 'text-[#6E77A8]'}`}>
                    {p.score} pts
                  </span>
                </motion.div>
              </div>
            )
          })}
        </div>

        {/* Remaining players */}
        {rest.length > 0 && (
          <div className="space-y-2 max-w-xl mx-auto mb-8">
            {rest.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-[16px] bg-white/5 px-4 py-2.5"
              >
                <span className="font-display font-bold text-[#6E77A8] w-6">{i + 4}</span>
                <span className="text-xl leading-none">{p.emoji}</span>
                <span className="font-display font-bold text-[#FFF8F0]">{p.name}</span>
                <span className="font-body font-semibold text-[#9AA3D0] ml-auto">{p.score} pts</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Button
            size="lg"
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
            Play again 🔁
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </GameLayout>
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

  const VoterCluster: React.FC<{ side: 'A' | 'B' }> = ({ side }) => {
    const voters = Object.entries(votes).filter(([, choice]) => choice === side)
    if (voters.length === 0) return null
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-3 px-4 py-2 rounded-full bg-[#151936]/70 backdrop-blur-sm z-20">
        {voters.map(([pid], index) => {
          const player = playerLookup.get(pid)
          if (!player) return null
          return (
            <motion.span
              key={pid}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: index * 0.04 }}
              className="text-3xl drop-shadow-lg"
              title={player.name}
            >
              {player.emoji}
            </motion.span>
          )
        })}
      </div>
    )
  }

  const ManagePlayers = (
    <Dialog open={showPlayersModal} onOpenChange={setShowPlayersModal}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Manage players">
          <Users className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm rounded-[24px] bg-[#1F2450] border-white/[0.07] text-[#FFF8F0]">
        <DialogHeader>
          <DialogTitle className="font-display font-extrabold text-[#FFF8F0]">Players</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {players.length === 0 && (
            <p className="font-body text-sm text-[#9AA3D0] text-center py-4">No players yet</p>
          )}
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-[14px] bg-white/5 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.emoji}</span>
                <div>
                  <p className="font-display font-bold text-sm text-[#FFF8F0]">{p.name}</p>
                  <p className="font-body text-xs text-[#9AA3D0]">{p.score} pts</p>
                </div>
              </div>
              {confirmKickId === p.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2 text-xs"
                    onClick={() => handleKickPlayer(p.id)}
                  >
                    Kick
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setConfirmKickId(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 border-0 hover:text-[#FF6A6A]"
                  onClick={() => setConfirmKickId(p.id)}
                >
                  <UserX className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )

  // Reveal view (3-column) — replaces the old blur-overlay modal.
  if (showResult) {
    const winnerLetter = correctChoice
    return (
      <GameLayout className="max-w-6xl">
        <h1 className="text-center font-display font-extrabold text-[34px] md:text-[44px] text-[#FFF8F0] mb-6">
          <span className="text-[#57E6D2]">{winnerLetter} was real!</span>{' '}
          {correctCount} of {totalPlayers} got it 🎉
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Real photo */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative rounded-[24px] overflow-hidden border-4 border-[#57E6D2] shadow-[0_0_40px_rgba(87,230,210,0.25)] aspect-[4/3]"
          >
            <img src={currentRound.realImageUrl} className="w-full h-full object-cover" />
            <span className="absolute top-3 left-3 rounded-full bg-[#57E6D2] text-[#151936] font-display font-extrabold text-sm px-3 py-1 z-10">
              ✓ REAL
            </span>
            <VoterCluster side={correctChoice} />
          </motion.div>

          {/* AI photo */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="relative rounded-[24px] overflow-hidden border-4 border-white/10 aspect-[4/3]"
          >
            <img
              src={currentRound.aiImageUrl}
              className="w-full h-full object-cover"
              style={{ filter: 'saturate(.6) brightness(.8)' }}
            />
            <span className="absolute top-3 left-3 rounded-full bg-[#FF6A6A] text-[#151936] font-display font-extrabold text-sm px-3 py-1 z-10">
              🤖 AI
            </span>
            <VoterCluster side={correctChoice === 'A' ? 'B' : 'A'} />
          </motion.div>

          {/* Standings */}
          <div className="rounded-[24px] border border-white/[0.07] bg-[#1F2450] p-5 flex flex-col">
            <h3 className="font-display font-bold text-[#FFF8F0] text-lg mb-4">Standings</h3>
            <div className="space-y-2 flex-1">
              {players.map((p, i) => {
                const rank = i + 1
                const prev = prevRanksRef.current[p.id] ?? rank
                const delta = prev - rank
                const isLeader = rank === 1
                return (
                  <motion.div
                    layout
                    key={p.id}
                    className={`flex items-center gap-3 rounded-[14px] px-3 py-2 ${
                      isLeader ? 'bg-[#FFC94D]/12' : 'bg-white/5'
                    }`}
                  >
                    <span className={`font-display font-extrabold w-5 ${isLeader ? 'text-[#FFC94D]' : 'text-[#6E77A8]'}`}>
                      {rank}
                    </span>
                    <span className="text-xl leading-none">{p.emoji}</span>
                    <span className="font-display font-bold text-[#FFF8F0] truncate">{p.name}</span>
                    {delta > 0 && (
                      <span className="font-body text-xs font-bold text-[#57E6D2]">▲{delta}</span>
                    )}
                    {delta < 0 && (
                      <span className="font-body text-xs font-bold text-[#FF6A6A]">▼{-delta}</span>
                    )}
                    <span className={`font-display font-extrabold ml-auto ${isLeader ? 'text-[#FFC94D]' : 'text-[#FFF8F0]'}`}>
                      {p.score}
                    </span>
                  </motion.div>
                )
              })}
            </div>
            <Button className="w-full mt-4" onClick={nextRound}>
              {currentRoundIndex + 1 >= totalRounds ? 'See results →' : 'Next round →'}
            </Button>
          </div>
        </div>
        {showAds && <AdBanner />}
      </GameLayout>
    )
  }

  // Round view
  return (
    <GameLayout className="max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <span className="font-display font-extrabold text-2xl text-[#FFF8F0]">
            Round {currentRoundIndex + 1} <span className="text-[#9AA3D0]">of {settings?.rounds ?? '?'}</span>
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1.5 font-body text-sm text-[#9AA3D0]">
            {votedCount} of {totalPlayers} voted
          </span>
        </div>

        <CountdownRing value={timeLeft} total={settings?.timeLimit ?? 15} size={76} />

        <div className="flex items-center gap-2">
          {ManagePlayers}
          {settings?.revealMode === 'after_round' && (
            <Button variant="secondary" size="sm" onClick={() => revealResult()}>
              Reveal
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSkipPicture} disabled={isReplacing}>
            {isReplacing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Swap this pair ↻'}
          </Button>
        </div>
      </div>

      <h2 className="text-center font-display font-extrabold text-[34px] text-[#FFF8F0] mb-8">
        Which one's real?
      </h2>

      {/* Images */}
      <div className="grid grid-cols-2 gap-8">
        {(['A', 'B'] as const).map((letter) => {
          const img = letter === 'A' ? leftImage : rightImage
          const badge =
            letter === 'A'
              ? 'bg-[#FF8552] text-[#151936] shadow-[0_4px_0_#C25327]'
              : 'bg-[#57E6D2] text-[#151936] shadow-[0_4px_0_#2FA391]'
          return (
            <div key={letter} className="relative aspect-[4/3]">
              <div
                className={`absolute -top-3.5 -left-3.5 w-11 h-11 rounded-[14px] flex items-center justify-center font-display font-extrabold text-xl z-20 ${badge}`}
              >
                {letter}
              </div>
              <img
                src={img}
                className="w-full h-full object-cover rounded-[24px] border-[3px] border-white/10"
              />
              {liveVotesVisible && <VoterCluster side={letter} />}
            </div>
          )
        })}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mt-8">
        {Array.from({ length: totalRounds }).map((_, idx) => (
          <div
            key={idx}
            className={`h-2 rounded-full transition-colors ${
              idx < currentRoundIndex
                ? 'bg-[#57E6D2] w-[22px]'
                : idx === currentRoundIndex
                  ? 'bg-[#FF8552] w-[28px]'
                  : 'bg-white/12 w-[22px]'
            }`}
          />
        ))}
      </div>
      {showAds && <AdBanner />}
    </GameLayout>
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
        emoji: '👑',
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
      }}
    >
      <GameHostContent code={code} />
    </RoomProvider>
  )
}

export default GameHost
