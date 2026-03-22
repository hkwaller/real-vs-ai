import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { Loader2, UserPlus, Smile } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

const EMOJIS = [
  '😀',
  '😎',
  '🤖',
  '👻',
  '👽',
  '👾',
  '🐱',
  '🐶',
  '🦊',
  '🦁',
  '🦄',
  '🐲',
  '😇',
  '🤩',
  '🥳',
  '🤯',
  '🤠',
  '🤡',
  '😈',
  '👹',
  '👺',
  '🙈',
  '🙉',
  '🙊',
  '🐼',
  '🐻',
  '🐨',
  '🐯',
  '🐷',
  '🐸',
  '🐒',
  '🦍',
  '🐔',
  '🐧',
  '🐦',
  '🦉',
  '🦋',
  '🐢',
  '🐍',
  '🐙',
  '🦀',
  '🐠',
  '🐳',
  '🐬',
  '🦖',
  '🐉',
  '🧚',
  '🧜',
  '🧙',
  '🧛',
  '🧟',
  '🧞',
  '🧑‍🚀',
  '🧑‍🎤',
  '🧑‍🎨',
  '🧑‍💻',
  '🧑‍🔬',
  '🧑‍🎓',
  '🧑‍🏫',
  '🧑‍⚖️',
  '🧑‍🌾',
  '🧑‍🍳',
  '🧑‍🔧',
  '🧑‍🏭',
  '🧑‍💼',
  '🧑‍✈️',
  '🧑‍🚒',
  '👮',
  '🕵️',
  '💂',
  '👷',
  '🤴',
  '👸',
  '🤵',
  '👰',
  '👼',
  '🎅',
  '🦸',
  '🦹',
  '🧝',
  '🧟‍♀️',
  '🧞‍♂️',
  '🧜‍♀️',
  '🧚‍♂️',
]

const JoinGame: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [code, setCode] = useState(searchParams.get('code') || '')
  const [name, setName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const handleJoin = () => {
    if (!code || !name) return
    setLoading(true)

    const upperCode = code.toUpperCase()
    const resolvedEmoji = selectedEmoji ?? EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    const playerId = crypto.randomUUID()

    // Keyed by playerId so multiple tabs in the same browser get independent identities
    localStorage.setItem(`rvai_player_${playerId}`, JSON.stringify({ name, emoji: resolvedEmoji }))

    navigate(`/play/${upperCode}?pid=${playerId}`)
  }

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto"
      >
        <Card className="text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-pink-400" />
              Join Game
            </CardTitle>
            <CardDescription>Enter your details to join the fun</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Game Code</label>
              <Input
                placeholder="ABCD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center text-2xl tracking-widest uppercase font-mono bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                className="bg-slate-900/50"
              />
            </div>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Smile className="w-4 h-4 text-muted-foreground" />
                  Choose Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`text-2xl p-2 rounded-lg transition-all ${
                        selectedEmoji === emoji
                          ? 'bg-indigo-500/20 ring-2 ring-indigo-500 scale-110'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button
              variant="neon"
              size="lg"
              className="w-full"
              onClick={handleJoin}
              disabled={loading || !code || !name}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Join Game'}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </GameLayout>
  )
}

export default JoinGame
