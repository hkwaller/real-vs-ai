import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { Loader2, CheckCircle, Trophy } from 'lucide-react'
import {
  RoomProvider,
  useStorage,
  useMutation,
  useUpdateMyPresence,
  LiveList,
  LiveMap,
  LiveObject,
} from '@/liveblocks.config'

// Inner component — uses Liveblocks hooks
const PlayerGameContent: React.FC<{ playerId: string; playerName: string; playerEmoji: string }> = ({
  playerId,
  playerName,
  playerEmoji,
}) => {
  const navigate = useNavigate()
  const [hasVoted, setHasVoted] = useState(false)
  const [voteChoice, setVoteChoice] = useState<'A' | 'B' | null>(null)
  const [registered, setRegistered] = useState(false)

  const updatePresence = useUpdateMyPresence()

  // Liveblocks storage — null while loading, value once hydrated
  const gameStatus = useStorage((root) => root.gameStatus?.value ?? null)
  const currentRoundIndexObj = useStorage((root) => root.currentRoundIndex)
  const rounds = useStorage((root) => root.rounds)

  const currentRoundIndex = currentRoundIndexObj?.value ?? 0
  const currentRound = rounds?.[currentRoundIndex] ?? null

  // Register player in Storage once storage has loaded (deduplicates by playerId)
  const registerPlayer = useMutation(
    ({ storage }) => {
      const playerList = storage.get('players')
      const scoreMap = storage.get('scores')
      for (let i = 0; i < playerList.length; i++) {
        if (playerList.get(i)?.id === playerId) return // already registered
      }
      playerList.push({ id: playerId, name: playerName, emoji: playerEmoji })
      scoreMap.set(playerId, 0)
    },
    [playerId, playerName, playerEmoji],
  )

  // Wait for storage to hydrate (gameStatus !== null) before registering
  useEffect(() => {
    if (registered || gameStatus === null) return
    setRegistered(true)
    registerPlayer()
  }, [gameStatus, registered])

  // Reset vote state when round changes
  useEffect(() => {
    setHasVoted(false)
    setVoteChoice(null)
    updatePresence({ hasVoted: false, currentVote: null })
  }, [currentRoundIndex])

  const handleVote = (choice: 'A' | 'B') => {
    if (hasVoted) return
    setVoteChoice(choice)
    setHasVoted(true)
    updatePresence({ hasVoted: true, currentVote: choice })
  }

  // Game over
  if (gameStatus === 'finished') {
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

  // Waiting (game not started or between rounds)
  if (gameStatus !== 'playing' || !currentRound) {
    return (
      <GameLayout>
        <Card className="text-center p-10 border-0">
          <Loader2 className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold">Waiting for Host...</h1>
          <p className="text-muted-foreground mt-2">Get ready!</p>
          <button
            onClick={() => navigate('/join')}
            className="mt-6 text-xs text-muted-foreground underline underline-offset-4"
          >
            Wrong game code? Go back
          </button>
        </Card>
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      <div className="flex flex-col items-center space-y-8 w-full max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-xl font-medium text-indigo-300">Round {currentRoundIndex + 1}</h2>
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

// Outer component — mounts RoomProvider
const PlayerGame: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const playerId = localStorage.getItem('rvai_player_id')
  const playerName = localStorage.getItem('rvai_player_name') ?? ''
  const playerEmoji = localStorage.getItem('rvai_player_emoji') ?? '😀'

  useEffect(() => {
    if (!playerId) navigate(`/join${code ? `?code=${code}` : ''}`)
  }, [playerId, navigate, code])

  if (!playerId || !code) return null

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
