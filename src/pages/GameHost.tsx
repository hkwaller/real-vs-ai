import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Users, Trophy, Crown } from 'lucide-react'
import confetti from 'canvas-confetti'
import {
  RoomProvider,
  useOthers,
  useStorage,
  useMutation,
  useBroadcastEvent,
  LiveList,
  LiveMap,
  LiveObject,
} from '@/liveblocks.config'

type RoundData = { id: string; realImageUrl: string; aiImageUrl: string }

// Inner component — all game logic lives here
const GameHostContent: React.FC<{ code: string }> = ({ code }) => {
  const [timeLeft, setTimeLeft] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showScoreDialog, setShowScoreDialog] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Liveblocks storage
  const roundsStorage = useStorage((root) => root.rounds)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const gameStatusObj = useStorage((root) => root.gameStatus)
  const settingsObj = useStorage((root) => root.settings)
  const storedPlayers = useStorage((root) => root.players)
  const scores = useStorage((root) => root.scores)

  // Presence
  const others = useOthers()

  const broadcast = useBroadcastEvent()

  // Derived values
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

  // Votes derived from presence (non-host players who have voted)
  const votes = useMemo(() => {
    const map: Record<string, 'A' | 'B'> = {}
    others
      .filter((o) => !o.presence.isHost && o.presence.hasVoted && o.presence.currentVote)
      .forEach((o) => {
        map[o.presence.playerId] = o.presence.currentVote!
      })
    return map
  }, [others])

  // Players with scores for leaderboard
  const players = useMemo(() => {
    if (!storedPlayers || !scores) return []
    return [...storedPlayers]
      .map((p) => ({ ...p, score: scores.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
  }, [storedPlayers, scores])

  // Mutations
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

  // Generate rounds from Supabase Storage and store in Liveblocks
  const generateRoundsAsync = async (count: number) => {
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
        realImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`)
          .data.publicUrl,
        aiImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`)
          .data.publicUrl,
      }))

      // Update localStorage with used image names
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

    storeRounds(roundsData)
    setTimeLeft(settings?.timeLimit ?? 15)
  }

  // Initialize: generate rounds once storage is loaded
  useEffect(() => {
    if (initialized || roundsStorage === null || settings === null) return
    setInitialized(true)

    if (roundsStorage.length === 0) {
      generateRoundsAsync(settings.rounds)
    } else {
      setTimeLeft(settings.timeLimit)
    }
  }, [roundsStorage, settings, initialized])

  // Reset state when current round changes (track by round ID)
  const prevRoundIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentRound || currentRound.id === prevRoundIdRef.current) return
    prevRoundIdRef.current = currentRound.id

    setShowResult(false)
    setShowScoreDialog(false)
    setTimeLeft(settings?.timeLimit ?? 15)
    preloadNextRound(currentRoundIndex + 1)
  }, [currentRound?.id])

  // Auto-reveal when all players vote
  useEffect(() => {
    const playerCount = storedPlayers?.length ?? 0
    const voteCount = Object.keys(votes).length
    if (playerCount > 0 && voteCount === playerCount && !showResult && currentRound) {
      const timeout = setTimeout(() => revealResultRef.current(), 1000)
      return () => clearTimeout(timeout)
    }
  }, [votes, storedPlayers, showResult, currentRound])

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !showResult) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearInterval(timer)
    } else if (timeLeft === 0 && !showResult && currentRound && initialized) {
      revealResultRef.current()
    }
  }, [timeLeft, showResult, currentRound, initialized])

  // Space key to reveal
  const revealResultRef = useRef<() => void>(() => {})
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') revealResultRef.current()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

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

    if (settings?.revealMode !== 'after_round') {
      setShowScoreDialog(true)
    }

    if (!currentRound) return

    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice = isRealLeft ? 'A' : 'B'

    const updates = Object.entries(votes).map(([playerId, choice]) => ({
      playerId,
      increment: choice === correctChoice ? 100 : 0,
    }))

    updateScores(updates)

    if (settings?.revealMode === 'instant') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    }
  }

  // Keep ref current so keydown and effects always call the latest version
  revealResultRef.current = revealResult

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
    return <div className="text-white text-center p-10">Loading game...</div>
  }

  // Game over
  if (gameStatus === 'finished') {
    if (players.length > 0) {
      const history = JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]')
      const gameRecord = { date: new Date().toISOString(), gameId: code, scores: players }
      if (!history.some((h: { gameId: string }) => h.gameId === code)) {
        history.push(gameRecord)
        localStorage.setItem('real_vs_ai_history', JSON.stringify(history))
      }
    }

    return (
      <GameLayout>
        <Card className="text-center p-10 max-w-2xl mx-auto">
          <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 animate-bounce" />
          <h1 className="text-5xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
            Game Over!
          </h1>
          <p className="text-xl text-muted-foreground mb-8">Final Results</p>

          <div className="space-y-4 mb-8 text-left">
            {players.map((player, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                key={player.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  index === 0
                    ? 'bg-yellow-500/20 border-yellow-500/50'
                    : 'bg-white/5 border-white/10',
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'font-mono font-bold w-8 h-8 flex items-center justify-center rounded-full',
                      index === 0
                        ? 'bg-yellow-500 text-black'
                        : 'bg-white/10 text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-3xl">{player.emoji}</span>
                  <span className="font-bold text-xl">{player.name}</span>
                  {index === 0 && <Crown className="w-6 h-6 text-yellow-400" />}
                </div>
                <span className="font-mono font-bold text-2xl">{player.score}</span>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => (window.location.href = '/')} variant="outline" size="lg">
              Back to Home
            </Button>
            <Button onClick={() => (window.location.href = '/create')} variant="neon" size="lg">
              Play Again
            </Button>
          </div>
        </Card>
      </GameLayout>
    )
  }

  const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
  const leftImage = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const rightImage = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl

  // Build a flat players lookup for emoji display
  const playerLookup = new Map(
    (storedPlayers ?? []).map((p) => [p.id, { ...p, score: scores?.get(p.id) ?? 0 }]),
  )

  return (
    <GameLayout className="max-w-6xl">
      <div className="flex flex-col h-full gap-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold">
            Round {currentRoundIndex + 1} / {settings?.rounds ?? '?'}
          </div>
          <div
            className={cn(
              'text-4xl font-black font-mono p-4 rounded-xl border-2',
              timeLeft <= 5
                ? 'text-red-500 border-red-500 animate-pulse'
                : 'text-indigo-400 border-indigo-500',
            )}
          >
            {timeLeft}s
          </div>
          <div className="flex items-center gap-4">
            {settings?.revealMode === 'after_round' && !showResult && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revealResult()}
                className="animate-pulse"
              >
                Finish Round
              </Button>
            )}
            {settings?.revealMode === 'after_round' && showResult && !showScoreDialog && (
              <Button variant="neon" size="sm" onClick={() => setShowScoreDialog(true)}>
                Show Scores
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              <span className="text-xl">
                {Object.keys(votes).length} / {storedPlayers?.length ?? 0} Votes
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Area: Images */}
        <div className="flex-1 min-h-[500px] relative">
          <div
            className={cn(
              'grid grid-cols-2 gap-8 h-full transition-all duration-500',
              showResult && settings?.revealMode === 'instant'
                ? 'opacity-40 scale-95 blur-sm'
                : 'opacity-100',
            )}
          >
            {/* Image A */}
            <div className="relative group">
              <div className="absolute top-4 left-4 z-10 bg-black/50 px-4 py-2 rounded-lg text-2xl font-bold border border-white/20">
                A
              </div>
              <img
                src={leftImage}
                className={cn(
                  'w-full h-full object-cover rounded-2xl border-4 transition-all duration-500',
                  showResult && isRealLeft ? 'border-green-500' : 'border-transparent',
                  showResult && !isRealLeft ? 'border-red-500' : '',
                )}
              />
              <AnimatePresence mode="popLayout">
                {showResult &&
                  Object.entries(votes).filter(([_, choice]) => choice === 'A').length > 0 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-white/10 min-h-[60px] items-center justify-center">
                      {Object.entries(votes)
                        .filter(([_, choice]) => choice === 'A')
                        .map(([pid, _], index) => {
                          const player = playerLookup.get(pid)
                          if (!player) return null
                          return (
                            <motion.div
                              key={pid}
                              initial={{ scale: 0, y: 20, opacity: 0 }}
                              animate={{ scale: 1, y: 0, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                                delay:
                                  settings?.revealMode === 'after_round' ? index * 0.05 : 0,
                              }}
                              className="text-4xl drop-shadow-lg relative hover:z-30 hover:scale-125 transition-transform cursor-default"
                              title={player.name}
                            >
                              {player.emoji}
                            </motion.div>
                          )
                        })}
                    </div>
                  )}
              </AnimatePresence>
            </div>

            {/* Image B */}
            <div className="relative group">
              <div className="absolute top-4 left-4 z-10 bg-black/50 px-4 py-2 rounded-lg text-2xl font-bold border border-white/20">
                B
              </div>
              <img
                src={rightImage}
                className={cn(
                  'w-full h-full object-cover rounded-2xl border-4 transition-all duration-500',
                  showResult && !isRealLeft ? 'border-green-500' : 'border-transparent',
                  showResult && isRealLeft ? 'border-red-500' : '',
                )}
              />
              <AnimatePresence mode="popLayout">
                {showResult &&
                  Object.entries(votes).filter(([_, choice]) => choice === 'B').length > 0 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-white/10 min-h-[60px] items-center justify-center">
                      {Object.entries(votes)
                        .filter(([_, choice]) => choice === 'B')
                        .map(([pid, _], index) => {
                          const player = playerLookup.get(pid)
                          if (!player) return null
                          return (
                            <motion.div
                              key={pid}
                              initial={{ scale: 0, y: 20, opacity: 0 }}
                              animate={{ scale: 1, y: 0, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                                delay:
                                  settings?.revealMode === 'after_round' ? index * 0.05 : 0,
                              }}
                              className="text-4xl drop-shadow-lg relative hover:z-30 hover:scale-125 transition-transform cursor-default"
                              title={player.name}
                            >
                              {player.emoji}
                            </motion.div>
                          )
                        })}
                    </div>
                  )}
              </AnimatePresence>
            </div>
          </div>

          {/* Result Overlay */}
          <AnimatePresence>
            {showScoreDialog && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center z-20"
              >
                <Card className="w-full max-w-2xl bg-slate-900/90 text-white border-indigo-500/50 backdrop-blur-xl shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-center text-3xl flex items-center justify-center gap-3">
                      <Trophy className="w-8 h-8 text-yellow-400" />
                      Round Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold">
                        Option <span className="text-green-400">{isRealLeft ? 'A' : 'B'}</span> was
                        REAL!
                      </h3>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {players.map((player, index) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground w-6">
                              #{index + 1}
                            </span>
                            <span className="text-2xl">{player.emoji}</span>
                            <span className="font-bold">{player.name}</span>
                            {index === 0 && <Crown className="w-5 h-5 text-yellow-400" />}
                          </div>
                          <span className="font-mono font-bold text-indigo-300">
                            {player.score} pts
                          </span>
                        </div>
                      ))}
                    </div>

                    <Button onClick={nextRound} size="xl" variant="neon" className="w-full">
                      Next Round
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GameLayout>
  )
}

// Outer component — mounts RoomProvider
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
