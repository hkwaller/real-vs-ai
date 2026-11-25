import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, NameBlock, NO_EMOJI, Wordmark } from '@/components/Brand'
import Seo from '@/components/Seo'
import { Loader2 } from 'lucide-react'

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
  const [loading, setLoading] = useState(false)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!initialCode) inputsRef.current[0]?.focus()
  }, [initialCode])

  const code = cells.join('')
  const valid = code.length === CODE_LEN && name.trim().length > 0

  const handleCell = (index: number, raw: string) => {
    const char = raw
      .slice(-1)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
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
    const text = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LEN)
    if (!text) return
    const arr = Array(CODE_LEN).fill('')
    for (let i = 0; i < text.length; i++) arr[i] = text[i]
    setCells(arr)
    inputsRef.current[Math.min(text.length, CODE_LEN - 1)]?.focus()
  }

  const handleJoin = () => {
    if (!valid) return
    setLoading(true)
    const playerId = crypto.randomUUID()
    localStorage.setItem(
      `rvai_player_${playerId}`,
      JSON.stringify({ name: name.trim(), emoji: NO_EMOJI }),
    )
    navigate(`/play/${code}?pid=${playerId}`)
  }

  return (
    <main className="screen-phone bg-paper text-ink md:items-center md:justify-center md:bg-side-a">
      <Seo title="Join a game - Real or AI" path="/join" noindex />
      <div className="flex flex-col flex-1 w-full md:flex-none md:max-w-[440px] md:border-4 md:border-ink">
        <section className="bg-side-a text-ink px-6 pt-6 pb-8 flex flex-col gap-6">
          <div className="flex items-center justify-between type-label text-[15px]">
            <Wordmark className="text-lg" />
            <button type="button" onClick={() => navigate('/')} className="py-3 underline underline-offset-4">
              Home
            </button>
          </div>
          <h1 className="type-display text-[52px] leading-[0.9]">Join the party.</h1>
          <div className="flex flex-col gap-2">
            <label htmlFor="code-0" className="type-label text-sm">
              Party code · on the big screen
            </label>
            <div className="grid grid-cols-4 gap-2">
              {cells.map((c, i) => (
                <input
                  key={i}
                  id={`code-${i}`}
                  aria-label={`Code letter ${i + 1}`}
                  ref={(el) => {
                    inputsRef.current[i] = el
                  }}
                  value={c}
                  onChange={(e) => handleCell(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={1}
                  className="h-24 w-full min-w-0 bg-paper text-ink text-center type-display text-[56px] leading-none outline-none focus-visible:outline-4 focus-visible:outline-ink focus-visible:-outline-offset-4"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col gap-3 px-6 pt-8 pad-bottom-safe">
          <label htmlFor="player-name" className="type-label text-sm">
            Your name
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="MAYA"
            autoComplete="nickname"
            className="h-[72px] w-full border-4 border-ink bg-paper text-ink px-4 type-name text-[30px] placeholder:text-text-placeholder"
          />
          <p className="font-medium text-base text-text-muted">This is how you show up on the TV.</p>

          <div className="flex flex-col gap-2 mt-4">
            <span className="type-label text-sm">On the big screen</span>
            <NameBlock name={name.trim() || 'Your name'} tone="blue" className="self-start" />
          </div>

          <div className="mt-auto pt-8">
            <Button
              variant="ink"
              size="bar"
              className="h-[76px]"
              onClick={handleJoin}
              disabled={loading || !valid}
            >
              {loading ? (
                <>
                  Joining… <Loader2 className="animate-spin" />
                </>
              ) : (
                <>
                  I'm in <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default JoinGame
