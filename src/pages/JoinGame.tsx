import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { Loader2, Smile } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

const EMOJIS = [
  '😀', '😎', '🤖', '👻', '👽', '👾', '🐱', '🐶', '🦊', '🦁', '🦄', '🐲',
  '😇', '🤩', '🥳', '🤯', '🤠', '🤡', '😈', '👹', '👺', '🙈', '🙉', '🙊',
  '🐼', '🐻', '🐨', '🐯', '🐷', '🐸', '🐒', '🦍', '🐔', '🐧', '🐦', '🦉',
  '🦋', '🐢', '🐍', '🐙', '🦀', '🐠', '🐳', '🐬', '🦖', '🐉', '🧚', '🧜',
  '🧙', '🧛', '🧟', '🧞', '🧑‍🚀', '🧑‍🎤', '🧑‍🎨', '🧑‍💻', '🧑‍🔬', '🧑‍🎓',
  '🧑‍🏫', '🧑‍⚖️', '🧑‍🌾', '🧑‍🍳', '🧑‍🔧', '🧑‍🏭', '🧑‍💼', '🧑‍✈️', '🧑‍🚒',
  '👮', '🕵️', '💂', '👷', '🤴', '👸', '🤵', '👰', '👼', '🎅', '🦸', '🦹',
  '🧝', '🧟‍♀️', '🧞‍♂️', '🧜‍♀️', '🧚‍♂️',
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

    localStorage.setItem(`rvai_player_${playerId}`, JSON.stringify({ name, emoji: resolvedEmoji }))
    navigate(`/play/${upperCode}?pid=${playerId}`)
  }

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-8 space-y-8">
          <div>
            <p className="mission-label mb-2">Enlist</p>
            <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase tracking-wide">
              Join Mission
            </h1>
            <p className="text-[#8B97C8] text-sm mt-1">Enter your details to deploy</p>
          </div>

          <div className="space-y-5">
            {/* Game code */}
            <div className="space-y-2">
              <label className="mission-label">Mission Code</label>
              <Input
                placeholder="ABCD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center text-3xl tracking-[0.4em] uppercase font-space-mono bg-[#0B0F2E] border-[#2A3468] text-[#FF6B1A] focus:border-[#FF6B1A] focus:ring-[#FF6B1A]/20 h-14 placeholder:text-[#2A3468]"
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="mission-label">Operative Name</label>
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                className="bg-[#0B0F2E] border-[#2A3468] text-[#F5F0E8] focus:border-[#FF6B1A] focus:ring-[#FF6B1A]/20 h-12"
              />
            </div>

            {/* Emoji picker */}
            <div className="space-y-2">
              <label className="mission-label flex items-center gap-2">
                <Smile className="w-3 h-3" />
                Choose Avatar
              </label>
              <ScrollArea className="h-[180px] border border-[#2A3468] bg-[#0B0F2E] p-2">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`text-xl p-2 transition-all ${
                        selectedEmoji === emoji
                          ? 'bg-[#FF6B1A]/20 outline outline-2 outline-[#FF6B1A] scale-110'
                          : 'hover:bg-[#1A2355]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleJoin}
            disabled={loading || !code || !name}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {loading ? 'Deploying...' : 'Join Mission'}
          </Button>
        </div>
      </motion.div>
    </GameLayout>
  )
}

export default JoinGame
