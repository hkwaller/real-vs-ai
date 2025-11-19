import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Users, Trophy, Crown } from 'lucide-react'
import confetti from 'canvas-confetti'

interface GameState {
  status: 'playing' | 'finished'
  current_round: number
  settings: {
    rounds: number
    timeLimit: number
    revealMode?: 'instant' | 'after_round'
  }
}

interface Round {
  id: string
  real_image_url: string
  ai_image_url: string
  correct_option: 'real' | 'ai'
  round_number: number
}

interface Player {
  id: string
  name: string
  score: number
  emoji: string
}

const GameHost: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showScoreDialog, setShowScoreDialog] = useState(false)
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [players, setPlayers] = useState<Player[]>([])

  // Initialize game and rounds
  useEffect(() => {
    if (!code) return

    const initGame = async () => {
      // Get game details
      const { data: game } = await supabase
        .from('real_vs_ai_games')
        .select('*')
        .eq('id', code)
        .single()

      if (game) {
        setGameState(game as GameState)

        // Fetch players immediately to know total count
        const { data: currentPlayers } = await supabase
          .from('real_vs_ai_players')
          .select('*')
          .eq('game_id', code)

        if (currentPlayers) {
          setPlayers(currentPlayers as Player[])
        }

        // Generate rounds if not exists (simplified: just checking if we have rounds)
        const { count } = await supabase
          .from('real_vs_ai_rounds')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', code)

        if (count === 0) {
          await generateRounds(code, game.settings.rounds)
        }

        loadRound(code, game.current_round || 1)
      }
    }

    initGame()

    // Subscribe to votes and new players
    const channel = supabase
      .channel('game_host')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'real_vs_ai_votes',
          filter: `game_id=eq.${code}`,
        },
        (payload) => {
          setVotes((prev) => {
            const newVotes = { ...prev, [payload.new.player_id]: payload.new.choice }
            return newVotes
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'real_vs_ai_players',
          filter: `game_id=eq.${code}`,
        },
        (payload) => {
          setPlayers((prev) => [...prev, payload.new as Player])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [code])

  // Auto-finish round when all players have voted
  useEffect(() => {
    if (
      players.length > 0 &&
      Object.keys(votes).length === players.length &&
      !showResult &&
      currentRound
    ) {
      // Small delay to let the last animation play
      setTimeout(() => {
        revealResult()
      }, 1000)
    }
  }, [votes, players, showResult, currentRound])

  // Timer logic
  useEffect(() => {
    if (timeLeft > 0 && !showResult) {
      const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
      return () => clearInterval(timer)
    } else if (timeLeft === 0 && !showResult && currentRound) {
      revealResult()
    }
  }, [timeLeft, showResult, currentRound])

  const generateRounds = async (gameId: string, count: number) => {
    // Double check if rounds exist to prevent race conditions
    const { count: existingCount } = await supabase
      .from('real_vs_ai_rounds')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId)

    if (existingCount && existingCount > 0) return

    // Fetch images from storage (real folder)
    const { data: files } = await supabase.storage.from('real-vs-ai').list('real')

    let roundsData

    if (files && files.length > 0) {
      // Filter out .emptyFolderPlaceholder or hidden files if any
      const validFiles = files.filter(
        (f) => f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'),
      )

      // Filter out images shown today
      const today = new Date().toISOString().split('T')[0]
      const history = JSON.parse(
        localStorage.getItem('real_vs_ai_shown_images') || '{"date": "", "images": []}',
      )

      let availableFiles = validFiles
      if (history.date === today) {
        availableFiles = validFiles.filter((f) => !history.images.includes(f.name))
      }

      // If we don't have enough fresh images, fallback to all valid files
      if (availableFiles.length < count) {
        console.log('Not enough fresh images, falling back to all images')
        availableFiles = validFiles
      }

      // Shuffle and pick
      const shuffled = availableFiles.sort(() => 0.5 - Math.random())
      // Loop if we need more rounds than images
      const selected = []
      for (let i = 0; i < count; i++) {
        selected.push(shuffled[i % shuffled.length])
      }

      roundsData = selected.map((file, i) => {
        const realUrl = supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`)
          .data.publicUrl
        const aiUrl = supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`)
          .data.publicUrl

        return {
          game_id: gameId,
          round_number: i + 1,
          real_image_url: realUrl,
          ai_image_url: aiUrl,
          correct_option: 'real', // Legacy field, logic uses deterministic ID
        }
      })
    } else {
      // Fallback to placeholders
      roundsData = Array.from({ length: count }).map((_, i) => ({
        game_id: gameId,
        round_number: i + 1,
        real_image_url: `https://picsum.photos/seed/real${i}/800/600`,
        ai_image_url: `https://picsum.photos/seed/ai${i}/800/600?blur=2`,
        correct_option: 'real',
      }))
    }

    await supabase.from('real_vs_ai_rounds').insert(roundsData)

    // Update local storage with used images
    if (roundsData && roundsData.length > 0) {
      const today = new Date().toISOString().split('T')[0]
      let history = JSON.parse(
        localStorage.getItem('real_vs_ai_shown_images') || '{"date": "", "images": []}',
      )

      if (history.date !== today) {
        history = { date: today, images: [] }
      }

      const newImages = roundsData
        .map((r) => {
          // Extract filename from URL
          const url = r.real_image_url
          const filename = url.split('/').pop()
          return filename
        })
        .filter(Boolean)

      history.images = [...new Set([...history.images, ...newImages])]
      localStorage.setItem('real_vs_ai_shown_images', JSON.stringify(history))
    }
  }

  const loadRound = async (gameId: string, roundNum: number) => {
    const { data } = await supabase
      .from('real_vs_ai_rounds')
      .select('*')
      .eq('game_id', gameId)
      .eq('round_number', roundNum)
      .limit(1)
      .maybeSingle()

    if (data) {
      setCurrentRound(data as Round)
      setShowResult(false)
      setShowScoreDialog(false)
      setVotes({})
      setTimeLeft(gameState?.settings.timeLimit || 15)

      // Update game state
      await supabase.from('real_vs_ai_games').update({ current_round: roundNum }).eq('id', gameId)

      // Preload next round images
      preloadNextRound(gameId, roundNum + 1)
    } else {
      // Game Over
      setGameState((prev) => (prev ? { ...prev, status: 'finished' } : null))
      await supabase.from('real_vs_ai_games').update({ status: 'finished' }).eq('id', gameId)
    }
  }

  const preloadNextRound = async (gameId: string, nextRoundNum: number) => {
    const { data } = await supabase
      .from('real_vs_ai_rounds')
      .select('real_image_url, ai_image_url')
      .eq('game_id', gameId)
      .eq('round_number', nextRoundNum)
      .limit(1)
      .maybeSingle()

    if (data) {
      const img1 = new Image()
      img1.src = data.real_image_url
      const img2 = new Image()
      img2.src = data.ai_image_url
    }
  }

  const revealResult = async () => {
    if (showResult) return // Prevent double trigger
    setShowResult(true)
    
    // Only show dialog immediately if NOT in after_round mode
    if (gameState?.settings.revealMode !== 'after_round') {
      setShowScoreDialog(true)
    }

    if (!currentRound || !code) return

    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice = isRealLeft ? 'A' : 'B'

    // Fetch all votes for this round
    const { data: roundVotes } = await supabase
      .from('real_vs_ai_votes')
      .select('*')
      .eq('game_id', code)
      .eq('round_id', currentRound.id)

    if (roundVotes) {
      // Calculate score updates
      const updates = roundVotes.map((vote) => {
        const isCorrect = vote.choice === correctChoice
        return {
          id: vote.player_id,
          score_increment: isCorrect ? 100 : 0,
        }
      })

      // Update players scores
      for (const update of updates) {
        if (update.score_increment > 0) {
          await supabase.rpc('real_vs_ai_increment_score', {
            row_id: update.id,
            amount: update.score_increment,
          })
        }
      }

      // Fetch updated leaderboard
      const { data: updatedPlayers } = await supabase
        .from('real_vs_ai_players')
        .select('*')
        .eq('game_id', code)
        .order('score', { ascending: false })

      if (updatedPlayers) {
        setPlayers(updatedPlayers as Player[])
      }
    }

    if (currentRound?.correct_option && gameState?.settings.revealMode === 'instant') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }

  const nextRound = () => {
    if (gameState && currentRound) {
      loadRound(code!, currentRound.round_number + 1)
    }
  }

  if (!gameState || !currentRound)
    return <div className="text-white text-center p-10">Loading game...</div>

  if (gameState.status === 'finished') {
    // Save high scores to local storage as backup
    if (players.length > 0) {
      const history = JSON.parse(localStorage.getItem('real_vs_ai_history') || '[]')
      const gameRecord = {
        date: new Date().toISOString(),
        gameId: code,
        scores: players,
      }
      // Avoid duplicates
      if (!history.some((h: any) => h.gameId === code)) {
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

  const leftImage = isRealLeft ? currentRound.real_image_url : currentRound.ai_image_url
  const rightImage = isRealLeft ? currentRound.ai_image_url : currentRound.real_image_url

  return (
    <GameLayout className="max-w-6xl">
      <div className="flex flex-col h-full gap-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold">
            Round {currentRound.round_number} / {gameState.settings.rounds}
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
            {gameState.settings.revealMode === 'after_round' && !showResult && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revealResult()}
                className="animate-pulse"
              >
                Finish Round
              </Button>
            )}
            {gameState.settings.revealMode === 'after_round' && showResult && !showScoreDialog && (
              <Button
                variant="neon"
                size="sm"
                onClick={() => setShowScoreDialog(true)}
                className="animate-bounce"
              >
                Show Scores
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              <span className="text-xl">
                {Object.keys(votes).length} / {players.length} Votes
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Area: Images or Leaderboard */}
        <div className="flex-1 min-h-[500px] relative">
          {/* Images Layer */}
          <div
            className={cn(
              'grid grid-cols-2 gap-8 h-full transition-all duration-500',
              showResult && gameState.settings.revealMode === 'instant' ? 'opacity-40 scale-95 blur-sm' : 'opacity-100',
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
              {/* Emojis for A */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-white/10 min-h-[60px] items-center justify-center">
                <AnimatePresence mode="popLayout">
                  {Object.entries(votes)
                    .filter(([_, choice]) => choice === 'A')
                    .map(([pid, _], index) => {
                      const player = players.find((p) => p.id === pid)
                      if (!player) return null
                      
                      // In after_round mode, hide votes until result is shown
                      if (gameState.settings.revealMode === 'after_round' && !showResult) {
                        return null
                      }

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
                            delay: gameState.settings.revealMode === 'after_round' ? index * 0.05 : 0
                          }}
                          className="text-4xl drop-shadow-lg relative hover:z-30 hover:scale-125 transition-transform cursor-default"
                          title={player.name}
                        >
                          {player.emoji}
                        </motion.div>
                      )
                    })}
                </AnimatePresence>
              </div>
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
              {/* Emojis for B */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex -space-x-4 z-20 px-4 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-white/10 min-h-[60px] items-center justify-center">
                <AnimatePresence mode="popLayout">
                  {Object.entries(votes)
                    .filter(([_, choice]) => choice === 'B')
                    .map(([pid, _], index) => {
                      const player = players.find((p) => p.id === pid)
                      if (!player) return null

                      // In after_round mode, hide votes until result is shown
                      if (gameState.settings.revealMode === 'after_round' && !showResult) {
                        return null
                      }

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
                            delay: gameState.settings.revealMode === 'after_round' ? index * 0.05 : 0
                          }}
                          className="text-4xl drop-shadow-lg relative hover:z-30 hover:scale-125 transition-transform cursor-default"
                          title={player.name}
                        >
                          {player.emoji}
                        </motion.div>
                      )
                    })}
                </AnimatePresence>
              </div>
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

export default GameHost
