import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
import AdBanner from '@/components/AdBanner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Users, Trophy, Crown, UserX, X, Edit3Icon, Rocket, Loader2 } from 'lucide-react'
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
  const [showScoreDialog, setShowScoreDialog] = useState(false)
  const [initialized, setInitialized] = useState(false)
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

  const replaceRound = useMutation(({ storage }, newRound: RoundData) => {
    storage.get('rounds').set(currentRoundIndex, newRound)
  }, [currentRoundIndex])

  const fetchReplacementImage = async (): Promise<RoundData | null> => {
    const { data: files } = await supabase.storage.from('real-vs-ai').list('real')
    if (!files) return null

    const validFiles = files.filter(
      (f) => !f.name.startsWith('.') && f.name !== '.emptyFolderPlaceholder',
    )

    // Exclude filenames already used in this game
    const usedNames = new Set(
      (roundsStorage ?? []).map((r) => r.realImageUrl.split('/real/').pop() ?? ''),
    )
    const available = validFiles.filter((f) => !usedNames.has(f.name))
    const pool = available.length > 0 ? available : validFiles

    const file = pool[Math.floor(Math.random() * pool.length)]
    return {
      id: crypto.randomUUID(),
      realImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data.publicUrl,
      aiImageUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data.publicUrl,
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

    storeRounds(roundsData)
    setTimeLeft(settings?.timeLimit ?? 15)
  }

  useEffect(() => {
    if (initialized || status !== 'connected' || roundsStorage === null || settings === null) return
    setInitialized(true)

    if (roundsStorage.length === 0) {
      generateRoundsAsync(settings.rounds)
    } else {
      setTimeLeft(settings.timeLimit)
    }
  }, [status, roundsStorage, settings, initialized])

  const prevRoundIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentRound || currentRound.id === prevRoundIdRef.current) return
    prevRoundIdRef.current = currentRound.id

    setShowResult(false)
    setShowScoreDialog(false)
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
    setTimeout(() => setShowScoreDialog(true), 2000)
    if (!currentRound) return

    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice = isRealLeft ? 'A' : 'B'
    const tl = settings?.timeLimit ?? 15

    const updates = others
      .filter((o) => !o.presence.isHost && o.presence.hasVoted)
      .map((o) => {
        const choice = o.presence.currentVote
        const tr = o.presence.timeRemaining ?? 0
        const correct = choice === correctChoice
        return {
          playerId: o.presence.playerId,
          increment: correct ? Math.max(10, Math.round(100 * (tr / tl))) : 0,
        }
      })

    updateScores(updates)
    broadcast({ type: 'ROUND_REVEALED' })

    const anyCorrect = updates.some((u) => u.increment > 0)
    if (anyCorrect) {
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
      <div className="min-h-screen bg-[#0B0F2E] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-2 h-2 rounded-full bg-[#FF6B1A] animate-pulse mx-auto" />
          <p className="font-space-mono text-sm text-[#8B97C8]">// Initializing mission...</p>
        </div>
      </div>
    )
  }

  // Game over
  if (gameStatus === 'finished') {
    if (players.length > 0) {
      const history = JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]')
      const gameRecord = { date: new Date().toISOString(), gameId: code, players }
      if (!history.some((h: { gameId: string }) => h.gameId === code)) {
        history.push(gameRecord)
        localStorage.setItem('real_vs_ai_history', JSON.stringify(history))
      }
    }

    return (
      <GameLayout>
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 max-w-2xl mx-auto text-center space-y-8">
          <div>
            <Trophy className="w-16 h-16 text-[#FFB830] mx-auto mb-4" />
            <p className="mission-label mb-2">Debrief</p>
            <h1 className="font-orbitron text-5xl font-black text-[#FF6B1A] uppercase text-glow-orange">
              Mission Complete
            </h1>
            <p className="text-[#8B97C8] mt-2">Final Results</p>
          </div>

          <div className="space-y-2 text-left">
            {players.map((player, index) => (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                key={player.id}
                className={cn(
                  'flex items-center justify-between p-4 border',
                  index === 0
                    ? 'bg-[#FFB830]/10 border-[#FFB830]/50'
                    : 'bg-[#1A2355] border-[#2A3468]',
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'font-space-mono font-bold w-8 h-8 flex items-center justify-center text-sm',
                      index === 0 ? 'text-[#FFB830]' : 'text-[#8B97C8]',
                    )}
                  >
                    #{index + 1}
                  </span>
                  <span className="text-2xl">{player.emoji}</span>
                  <span className="font-orbitron font-bold text-[#F5F0E8]">{player.name}</span>
                  {index === 0 && <Crown className="w-5 h-5 text-[#FFB830]" />}
                </div>
                <span className="font-space-mono font-bold text-xl text-[#FFB830]">
                  {player.score} PTS
                </span>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/')} variant="outline" size="lg">
              Return to Base
            </Button>
            <Button
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
              size="lg"
            >
              <Rocket className="mr-2 h-4 w-4" />
              Play Again
            </Button>
          </div>
        </div>
      </GameLayout>
    )
  }

  const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
  const leftImage = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const rightImage = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl

  const playerLookup = new Map(
    (storedPlayers ?? []).map((p) => [p.id, { ...p, score: scores?.get(p.id) ?? 0 }]),
  )

  return (
    <GameLayout className="max-w-6xl">
      <div className="flex flex-col h-full gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <p className="mission-label">Round</p>
            <div className="font-orbitron text-2xl font-bold text-[#F5F0E8]">
              {currentRoundIndex + 1}{' '}
              <span className="text-[#8B97C8]">/ {settings?.rounds ?? '?'}</span>
            </div>
          </div>

          <div
            className={cn(
              'font-space-mono text-5xl font-bold px-6 py-3 border-2 min-w-[120px] text-center transition-all duration-300',
              timeLeft <= 5
                ? 'text-[#FF3D1A] border-[#FF3D1A] shadow-[0_0_20px_rgba(255,61,26,0.5)] animate-pulse'
                : 'text-[#FF6B1A] border-[#FF6B1A] shadow-[0_0_15px_rgba(255,107,26,0.3)]',
            )}
          >
            {timeLeft}
          </div>

          <div className="flex items-center gap-4">
            {!showResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipPicture}
                disabled={isReplacing}
              >
                {isReplacing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skip Picture'}
              </Button>
            )}
            {settings?.revealMode === 'after_round' && !showResult && (
              <Button variant="destructive" size="sm" onClick={() => revealResult()}>
                Reveal
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="text-right space-y-0.5">
                <p className="mission-label">Votes</p>
                <p className="font-space-mono text-sm text-[#F5F0E8]">
                  {Object.keys(votes).length} / {storedPlayers?.length ?? 0}
                </p>
              </div>
              <Dialog open={showPlayersModal} onOpenChange={setShowPlayersModal}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="icon">
                    <Edit3Icon className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm bg-[#111840] border-[#2A3468] text-[#F5F0E8]">
                  <DialogHeader>
                    <DialogTitle className="font-orbitron uppercase tracking-widest text-[#F5F0E8]">
                      Operatives
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 mt-2">
                    {players.length === 0 && (
                      <p className="font-space-mono text-xs text-[#8B97C8] text-center py-4">
                        // No operatives yet
                      </p>
                    )}
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between border border-[#2A3468] px-3 py-2 bg-[#1A2355]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.emoji}</span>
                          <div>
                            <p className="font-orbitron text-xs font-bold text-[#F5F0E8]">
                              {p.name}
                            </p>
                            <p className="font-space-mono text-xs text-[#8B97C8]">{p.score} pts</p>
                          </div>
                        </div>
                        {confirmKickId === p.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleKickPlayer(p.id)}
                            >
                              Kick
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setConfirmKickId(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:text-[#FF3D1A]"
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
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="flex-1 min-h-[500px] relative">
          <div
            className={cn(
              'grid grid-cols-2 gap-6 h-full transition-all duration-500',
              showScoreDialog ? 'opacity-30 scale-95 blur-sm' : 'opacity-100',
            )}
          >
            {/* Image A */}
            <div className="relative">
              <div className="absolute top-3 left-3 z-10 bg-[#0B0F2E]/80 px-3 py-1.5 border border-[#2A3468]">
                <span className="font-orbitron text-lg font-bold text-[#F5F0E8]">A</span>
              </div>
              <img
                src={leftImage}
                className={cn(
                  'w-full h-full object-cover border-4 transition-all duration-500',
                  showResult && isRealLeft
                    ? 'border-[#00FFE5] shadow-[0_0_30px_rgba(0,255,229,0.4)]'
                    : '',
                  showResult && !isRealLeft
                    ? 'border-[#FF3D1A] shadow-[0_0_30px_rgba(255,61,26,0.4)]'
                    : '',
                  !showResult ? 'border-[#2A3468]' : '',
                )}
              />
              <AnimatePresence mode="popLayout">
                {(showResult || settings?.revealMode === 'instant') &&
                  Object.entries(votes).filter(([_, choice]) => choice === 'A').length > 0 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-[#0B0F2E]/70 backdrop-blur-sm border border-[#2A3468] min-h-[60px] items-center justify-center">
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
                                delay: settings?.revealMode === 'after_round' ? index * 0.05 : 0,
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
            <div className="relative">
              <div className="absolute top-3 left-3 z-10 bg-[#0B0F2E]/80 px-3 py-1.5 border border-[#2A3468]">
                <span className="font-orbitron text-lg font-bold text-[#F5F0E8]">B</span>
              </div>
              <img
                src={rightImage}
                className={cn(
                  'w-full h-full object-cover border-4 transition-all duration-500',
                  showResult && !isRealLeft
                    ? 'border-[#00FFE5] shadow-[0_0_30px_rgba(0,255,229,0.4)]'
                    : '',
                  showResult && isRealLeft
                    ? 'border-[#FF3D1A] shadow-[0_0_30px_rgba(255,61,26,0.4)]'
                    : '',
                  !showResult ? 'border-[#2A3468]' : '',
                )}
              />
              <AnimatePresence mode="popLayout">
                {(showResult || settings?.revealMode === 'instant') &&
                  Object.entries(votes).filter(([_, choice]) => choice === 'B').length > 0 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-[#0B0F2E]/70 backdrop-blur-sm border border-[#2A3468] min-h-[60px] items-center justify-center">
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
                                delay: settings?.revealMode === 'after_round' ? index * 0.05 : 0,
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

          {/* Round Result Overlay */}
          <AnimatePresence>
            {showScoreDialog && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center z-20"
              >
                <div className="corner-bracket w-full max-w-2xl bg-[#0B0F2E]/95 border border-[#FF6B1A] backdrop-blur-xl p-8 space-y-6">
                  <div className="text-center">
                    <p className="mission-label mb-2">Round Debrief</p>
                    <h2 className="font-orbitron text-3xl font-bold text-[#F5F0E8] uppercase">
                      Option{' '}
                      <span className="text-[#00FFE5]">{isRealLeft ? 'A' : 'B'}</span> was{' '}
                      <span className="text-[#00FFE5]">REAL</span>
                    </h2>
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {players.map((player, index) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 border border-[#2A3468] bg-[#111840]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-space-mono text-xs text-[#8B97C8] w-6">
                            #{index + 1}
                          </span>
                          <span className="text-2xl">{player.emoji}</span>
                          <span className="font-orbitron text-sm font-bold text-[#F5F0E8]">
                            {player.name}
                          </span>
                          {index === 0 && <Crown className="w-4 h-4 text-[#FFB830]" />}
                        </div>
                        <span className="font-space-mono font-bold text-[#FFB830]">
                          {player.score} PTS
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button onClick={nextRound} size="xl" className="w-full">
                    <Rocket className="mr-2 h-4 w-4" />
                    Next Round
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
