import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { Loader2 } from 'lucide-react'

const EMOJIS = [
  '🦊', '😎', '👾', '💀', '🥱', '🦄',
  '👽', '🐼', '🐸', '🦖', '🐙', '🤖',
  '😀', '👻', '🐱', '🐶', '🦁', '🐲',
  '😇', '🤩', '🥳', '🤯', '🤠', '🤡',
  '😈', '👹', '👺', '🙈', '🐻', '🐨',
  '🐯', '🐷', '🐔', '🐧', '🦉', '🦋',
  '🐢', '🐍', '🐳', '🐬', '🐉', '🧚',
]

const CODE_LEN = 4

const JoinGame: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initialCode = (searchParams.get('code') || '').toUpperCase().slice(0, CODE_LEN)
  const [cells, setCells] = useState<string[]>(() => {
    const arr = Array(CODE_LEN).fill('')
    for (let i = 0; i < initialCode.length; i++) arr[i] = initialCode[i]
    return arr
  })
  const [name, setName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined)
  const [showAllFaces, setShowAllFaces] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!initialCode) inputsRef.current[0]?.focus()
  }, [initialCode])

  const code = cells.join('')
  const valid = code.length === CODE_LEN && name.trim().length > 0

  const handleCell = (index: number, raw: string) => {
    const char = raw.slice(-1).toUpperCase().replace(/[^A-Z0-9]/g, '')
    setCells((prev) => {
      const next = [...prev]
      next[index] = char
      return next
    })
    if (char && index < CODE_LEN - 1) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !cells[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN)
    if (!text) return
    const arr = Array(CODE_LEN).fill('')
    for (let i = 0; i < text.length; i++) arr[i] = text[i]
    setCells(arr)
    inputsRef.current[Math.min(text.length, CODE_LEN - 1)]?.focus()
  }

  const handleJoin = () => {
    if (!valid) return
    setLoading(true)
    const resolvedEmoji = selectedEmoji ?? EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    const playerId = crypto.randomUUID()
    localStorage.setItem(`rvai_player_${playerId}`, JSON.stringify({ name: name.trim(), emoji: resolvedEmoji }))
    navigate(`/play/${code}?pid=${playerId}`)
  }

  const visibleFaces = showAllFaces ? EMOJIS : EMOJIS.slice(0, 11)

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[390px] mx-auto"
      >
        <div className="text-center mb-6">
          <h1 className="font-display font-extrabold text-3xl text-[#FFF8F0]">Join the party</h1>
          <p className="text-[#9AA3D0] mt-1">Grab the code from the big screen</p>
        </div>

        {/* Party code */}
        <label className="font-body font-semibold text-sm text-[#9AA3D0]">Party code</label>
        <div className="grid grid-cols-4 gap-3 mt-2">
          {cells.map((c, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el
              }}
              value={c}
              onChange={(e) => handleCell(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              inputMode="text"
              maxLength={1}
              className={`h-16 rounded-[16px] bg-white/5 border-2 text-center font-display font-extrabold text-3xl text-[#FFF8F0] uppercase outline-none transition-colors ${
                c ? 'border-[#FF8552]' : 'border-white/10'
              } focus:border-[#FF8552]`}
            />
          ))}
        </div>

        {/* Name */}
        <label className="font-body font-semibold text-sm text-[#9AA3D0] block mt-6 mb-2">Your name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={12} placeholder="Maya" />

        {/* Face picker */}
        <label className="font-body font-semibold text-sm text-[#9AA3D0] block mt-6 mb-2">Pick your face</label>
        <div className="grid grid-cols-6 gap-2">
          {visibleFaces.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedEmoji(emoji)}
              className={`aspect-square rounded-[14px] flex items-center justify-center text-2xl transition-all ${
                selectedEmoji === emoji
                  ? 'bg-[#FF8552]/20 border-2 border-[#FF8552] scale-[1.08]'
                  : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
              }`}
            >
              {emoji}
            </button>
          ))}
          {!showAllFaces && (
            <button
              type="button"
              onClick={() => setShowAllFaces(true)}
              className="aspect-square rounded-[14px] bg-white/5 hover:bg-white/10 flex items-center justify-center font-body font-semibold text-xs text-[#9AA3D0] transition-colors"
            >
              more
            </button>
          )}
        </div>

        <Button size="lg" className="w-full mt-8" onClick={handleJoin} disabled={loading || !valid}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Let's go! 🚀"}
        </Button>
      </motion.div>
    </GameLayout>
  )
}

export default JoinGame
