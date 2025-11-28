import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { supabase } from '@/lib/supabase'
import { Loader2, CheckCircle, Trophy } from 'lucide-react'

interface GameState {
  status: 'playing' | 'finished'
  current_round: number
}

interface Round {
  id: string
  round_number: number
  correct_option: 'real' | 'ai' // Not used here, but part of schema
}

const PlayerGame: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [voteChoice, setVoteChoice] = useState<'A' | 'B' | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)

  useEffect(() => {
    const pid = localStorage.getItem('real_vs_ai_player_id')
    if (!pid) {
      navigate('/')
      return
    }
    setPlayerId(pid)

    // Subscribe to game changes
    const gameChannel = supabase
      .channel('player_game')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'real_vs_ai_games',
          filter: `id=eq.${code}`,
        },
        (payload) => {
          const newGame = payload.new as GameState
          setGameState(newGame)

          // If round changed, reset state
          if (newGame.current_round !== gameState?.current_round) {
            fetchRound(newGame.current_round)
          }
        },
      )
      .subscribe()

    // Initial fetch
    const fetchGame = async () => {
      const { data } = await supabase.from('real_vs_ai_games').select('*').eq('id', code).single()

      if (data) {
        setGameState(data as GameState)
        fetchRound(data.current_round)
      }
    }

    fetchGame()

    return () => {
      supabase.removeChannel(gameChannel)
    }
  }, [code, navigate])

  const fetchRound = async (roundNum: number) => {
    if (roundNum === 0) return // Game hasn't started properly or is in lobby

    const { data } = await supabase
      .from('real_vs_ai_rounds')
      .select('*')
      .eq('game_id', code)
      .eq('round_number', roundNum)
      .limit(1)
      .maybeSingle()

    if (data) {
      setCurrentRound(data as Round)
      setHasVoted(false)
      setVoteChoice(null)
    }
  }

  const handleVote = async (choice: 'A' | 'B') => {
    if (!playerId || !currentRound || !code) return

    setVoteChoice(choice)
    setHasVoted(true)

    // Send vote
    await supabase.from('real_vs_ai_votes').insert({
      game_id: code,
      round_id: currentRound.id,
      player_id: playerId,
      choice: choice,
    })
  }

  if (!gameState) return <div className="text-white text-center p-10">Loading...</div>

  if (gameState.status === 'finished') {
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

  if (gameState.status !== 'playing' || !currentRound) {
    return (
      <GameLayout>
        <Card className="text-center p-10 border-0">
          <Loader2 className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold">Waiting for Host...</h1>
          <p className="text-muted-foreground mt-2">Get ready!</p>
        </Card>
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      <div className="flex flex-col items-center space-y-8 w-full max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-xl font-medium text-indigo-300">Round {currentRound.round_number}</h2>
          <h1 className="text-3xl font-bold mt-2">Which is REAL?</h1>
        </div>

        {!hasVoted ? (
          <div className="grid grid-cols-1 gap-4 w-full">
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
          </div>
        ) : (
          <Card className="w-full text-center py-10">
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-16 h-16 text-green-400" />
              <div>
                <h2 className="text-2xl font-bold">Vote Cast!</h2>
                <p className="text-muted-foreground">You chose Option {voteChoice}</p>
              </div>
              <p className="text-sm text-indigo-300 animate-pulse mt-4">Waiting for results...</p>
            </div>
          </Card>
        )}
      </div>
    </GameLayout>
  )
}

export default PlayerGame
