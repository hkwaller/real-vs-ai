import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import { Loader2, ZoomIn, X } from 'lucide-react'
import {
  getTodayDate,
  fetchSchedule,
  buildRounds,
  getDailyScores,
  saveDailyScore,
  msUntilMidnight,
  formatCountdown,
  type DailyRound,
  type DailyScore,
  type RoundDetail,
} from '@/lib/dailyChallenge'

type Phase = 'loading' | 'no_challenge' | 'already_done' | 'playing' | 'reveal' | 'finished'

type RoundResult = {
  correct: boolean
  correctChoice: 'A' | 'B'
  points: number
}

// Consecutive completed days ending today (or yesterday if today isn't done).
function computeStreak(): number {
  const scores = getDailyScores()
  let streak = 0
  const d = new Date()
  if (!scores[getTodayDate()]) d.setDate(d.getDate() - 1)
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!scores[key]) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function prettyDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  if (isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

const DailyChallenge: React.FC = () => {
  const { date: dateParam } = useParams<{ date?: string }>()
  const navigate = useNavigate()

  const date = dateParam ?? getTodayDate()
  const isToday = date === getTodayDate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [rounds, setRounds] = useState<DailyRound[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [roundDetails, setRoundDetails] = useState<RoundDetail[]>([])
  const [existingScore, setExistingScore] = useState<DailyScore | null>(null)
  const [countdown, setCountdown] = useState('')
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)

  const currentRound = rounds[roundIndex] ?? null

  useEffect(() => {
    async function load() {
      const scores = getDailyScores()
      if (scores[date]) {
        setExistingScore(scores[date])
        setPhase('already_done')
        return
      }
      const schedule = await fetchSchedule()
      if (!schedule || !schedule[date]) {
        setPhase('no_challenge')
        return
      }
      setRounds(buildRounds(date, schedule[date].images))
      setPhase('playing')
    }
    load()
  }, [date])

  useEffect(() => {
    if ((phase !== 'already_done' && phase !== 'finished') || !isToday) return
    const tick = () => setCountdown(formatCountdown(msUntilMidnight()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, isToday])

  useEffect(() => {
    if (phase !== 'playing') return
    setRoundResult(null)
  }, [phase === 'playing' ? currentRound?.id : null, phase])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedImage(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleVote = (choice: 'A' | 'B') => {
    if (phase !== 'playing' || !currentRound) return
    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice: 'A' | 'B' = isRealLeft ? 'A' : 'B'
    const correct = choice === correctChoice
    const points = correct ? 100 : 0

    setRoundResult({ correct, correctChoice, points })
    setScore((s) => s + points)
    setRoundDetails((prev) => [
      ...prev,
      {
        roundId: currentRound.id,
        realImageUrl: currentRound.realImageUrl,
        aiImageUrl: currentRound.aiImageUrl,
        isRealLeft,
        correctChoice,
        playerChoice: choice,
        correct,
        points,
      },
    ])
    setPhase('reveal')
  }

  const handleNext = () => {
    const nextIndex = roundIndex + 1
    if (nextIndex >= rounds.length) {
      const result: DailyScore = {
        score,
        maxScore: rounds.length * 100,
        rounds: rounds.length,
        completedAt: new Date().toISOString(),
        roundDetails,
      }
      saveDailyScore(date, result)
      setExistingScore(result)
      setPhase('finished')
    } else {
      setRoundIndex(nextIndex)
      setPhase('playing')
    }
  }

  const handleShare = () => {
    const details = existingScore?.roundDetails ?? []
    const correct = details.filter((r) => r.correct).length
    const grid = details.map((r) => (r.correct ? '🟩' : '🟥')).join('')
    const text = `Real vs AI — Today's five\n${correct}/${details.length} ${grid}\nCan you beat me? 🤖`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else navigator.clipboard.writeText(text)
  }

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <GameLayout>
        <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-10 max-w-sm mx-auto text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#57E6D2] mx-auto animate-spin" />
          <h1 className="font-display font-extrabold text-2xl text-[#FFF8F0]">Loading today's five…</h1>
        </div>
      </GameLayout>
    )
  }

  // --- No challenge ---
  if (phase === 'no_challenge') {
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-10 max-w-md mx-auto text-center space-y-5"
        >
          <div className="text-5xl">🗓️</div>
          <div>
            <h1 className="font-display font-extrabold text-3xl text-[#FFF8F0]">No challenge today</h1>
            <p className="text-[#9AA3D0] mt-2 text-sm">
              {isToday ? 'Check back tomorrow for a fresh five.' : `Nothing was scheduled for ${date}.`}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
            <Button variant="secondary" onClick={() => navigate('/daily/archive')}>Past challenges</Button>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  // --- Results (already done or just finished) — design 3h ---
  if ((phase === 'already_done' || phase === 'finished') && existingScore) {
    const details = existingScore.roundDetails ?? []
    const correctCount = details.filter((r) => r.correct).length
    const totalRounds = details.length || existingScore.rounds
    const streak = computeStreak()

    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto text-center flex flex-col items-center"
        >
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="font-display font-extrabold text-4xl text-[#FFF8F0]">
            {correctCount} out of {totalRounds}!
          </h1>
          <p className="text-[#9AA3D0] mt-2">
            {correctCount === totalRounds
              ? 'A perfect five. Incredible eye.'
              : correctCount >= totalRounds / 2
                ? 'Nice eye — the AI didn’t fool you much today.'
                : 'The AI got you today. Come back tomorrow!'}
          </p>

          {/* Result tiles */}
          <div className="flex items-center justify-center gap-2.5 mt-6">
            {details.map((rd, i) => (
              <div
                key={i}
                className={`w-11 h-11 rounded-[12px] flex items-center justify-center font-display font-extrabold text-lg ${
                  rd.correct
                    ? 'bg-[#57E6D2]/15 text-[#57E6D2] border border-[#57E6D2]/40'
                    : 'bg-[#FF6A6A]/15 text-[#FF6A6A] border border-[#FF6A6A]/40'
                }`}
              >
                {rd.correct ? '✓' : '✗'}
              </div>
            ))}
          </div>

          {streak > 0 && (
            <div className="mt-6 rounded-full bg-[#FFC94D]/12 px-4 py-2">
              <span className="font-body font-semibold text-sm text-[#FFC94D]">🔥 {streak}-day streak</span>
            </div>
          )}

          <div className="w-full mt-8 space-y-3">
            <Button size="lg" className="w-full" onClick={handleShare}>
              Challenge a friend 📤
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setShowReview((v) => !v)}>
                Review rounds
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Home
              </Button>
            </div>
          </div>

          {isToday && (
            <p className="font-body text-sm text-[#6E77A8] mt-6">
              Next five in <span className="font-display font-bold text-[#57E6D2]">{countdown}</span>
            </p>
          )}

          {/* Review rounds (toggle) */}
          <AnimatePresence>
            {showReview && details.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full mt-6 space-y-3 overflow-hidden text-left"
              >
                {details.map((rd, i) => {
                  const imgA = rd.isRealLeft ? rd.realImageUrl : rd.aiImageUrl
                  const imgB = rd.isRealLeft ? rd.aiImageUrl : rd.realImageUrl
                  return (
                    <div key={rd.roundId} className="rounded-[16px] border border-white/[0.07] bg-[#1F2450] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-body text-sm text-[#9AA3D0]">Round {i + 1}</span>
                        <span
                          className={`font-body text-sm font-bold ${rd.correct ? 'text-[#57E6D2]' : 'text-[#FF6A6A]'}`}
                        >
                          {rd.correct ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['A', 'B'] as const).map((opt) => {
                          const url = opt === 'A' ? imgA : imgB
                          const isReal = opt === rd.correctChoice
                          return (
                            <div
                              key={opt}
                              className={`relative overflow-hidden rounded-[12px] border-2 aspect-[4/3] ${
                                isReal ? 'border-[#57E6D2]' : 'border-white/10'
                              }`}
                            >
                              <img src={url} alt={`Option ${opt}`} className="w-full h-full object-cover" />
                              <span
                                className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 font-display font-bold text-xs ${
                                  isReal ? 'bg-[#57E6D2] text-[#151936]' : 'bg-[#151936]/80 text-[#9AA3D0]'
                                }`}
                              >
                                {isReal ? 'REAL' : 'AI'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </GameLayout>
    )
  }

  if (!currentRound) return null

  const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
  const imageA = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const imageB = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl
  const streak = computeStreak()

  // progress squares state
  const squares = rounds.map((_, i) => {
    if (i < roundDetails.length) return roundDetails[i].correct ? 'correct' : 'wrong'
    if (i === roundIndex) return 'current'
    return 'upcoming'
  })

  return (
    <GameLayout className="max-w-5xl">
      {/* Top strip */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <span className="font-body font-semibold text-sm text-[#FFF8F0]">
          ☀️ Today's five · {prettyDate(date)}
        </span>
        <div className="flex items-center gap-2">
          {squares.map((s, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-[4px] ${
                s === 'correct'
                  ? 'bg-[#57E6D2]'
                  : s === 'wrong'
                    ? 'bg-[#FF6A6A]'
                    : s === 'current'
                      ? 'bg-[#FF8552] ring-4 ring-[#FF8552]/25'
                      : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        {streak > 0 ? (
          <span className="font-body font-semibold text-sm text-[#FFC94D]">🔥 {streak}-day streak</span>
        ) : (
          <span className="font-body text-sm text-[#6E77A8]">
            Round {roundIndex + 1} of {rounds.length}
          </span>
        )}
      </div>

      <h1 className="text-center font-display font-extrabold text-[38px] text-[#FFF8F0] mb-6">
        Which one's real?
      </h1>

      <AnimatePresence mode="wait">
        {phase === 'reveal' && roundResult ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="grid grid-cols-2 gap-6 w-full">
              {(['A', 'B'] as const).map((opt) => {
                const url = opt === 'A' ? imageA : imageB
                const isReal = opt === roundResult.correctChoice
                return (
                  <div
                    key={opt}
                    className={`relative overflow-hidden rounded-[24px] border-4 aspect-[4/3] ${
                      isReal ? 'border-[#57E6D2] shadow-[0_0_40px_rgba(87,230,210,0.25)]' : 'border-white/10'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Option ${opt}`}
                      className="w-full h-full object-cover"
                      style={isReal ? undefined : { filter: 'saturate(.6) brightness(.8)' }}
                    />
                    <span
                      className={`absolute top-3 left-3 rounded-full px-3 py-1 font-display font-extrabold text-sm ${
                        isReal ? 'bg-[#57E6D2] text-[#151936]' : 'bg-[#FF6A6A] text-[#151936]'
                      }`}
                    >
                      {isReal ? '✓ REAL' : '🤖 AI'}
                    </span>
                  </div>
                )
              })}
            </div>

            <h2
              className="font-display font-extrabold text-3xl"
              style={{ color: roundResult.correct ? '#57E6D2' : '#FF6A6A' }}
            >
              {roundResult.correct ? 'Nailed it!' : 'Fooled!'}
            </h2>

            <Button size="lg" className="w-full max-w-sm" onClick={handleNext}>
              {roundIndex + 1 < rounds.length ? 'Next round →' : 'See results 🎯'}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="grid grid-cols-2 gap-6 w-full">
              {(['A', 'B'] as const).map((opt) => {
                const url = opt === 'A' ? imageA : imageB
                const badge =
                  opt === 'A'
                    ? 'bg-[#FF8552] text-[#151936] shadow-[0_4px_0_#C25327]'
                    : 'bg-[#57E6D2] text-[#151936] shadow-[0_4px_0_#2FA391]'
                return (
                  <motion.div
                    key={opt}
                    whileHover={{ y: -4 }}
                    className="relative aspect-[4/3] cursor-zoom-in"
                    onClick={() => setZoomedImage(url)}
                  >
                    <div
                      className={`absolute -top-3.5 -left-3.5 w-11 h-11 rounded-[14px] flex items-center justify-center font-display font-extrabold text-xl z-20 ${badge}`}
                    >
                      {opt}
                    </div>
                    <img
                      src={url}
                      alt={`Option ${opt}`}
                      className="w-full h-full object-cover rounded-[24px] border-[3px] border-white/10"
                    />
                    {opt === 'A' && (
                      <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-[#151936]/70 backdrop-blur-sm px-3 py-1 font-body text-xs text-[#FFF8F0]">
                        <ZoomIn className="w-3.5 h-3.5" /> tap to zoom
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-6 w-full">
              <button
                onClick={() => handleVote('A')}
                className="h-16 rounded-[16px] bg-[#FF8552] text-[#151936] font-display font-extrabold text-lg shadow-[0_6px_0_#C25327] hover:translate-y-[2px] hover:shadow-[0_4px_0_#C25327] active:translate-y-[2px] active:shadow-[0_4px_0_#C25327] transition-all"
              >
                A is real
              </button>
              <button
                onClick={() => handleVote('B')}
                className="h-16 rounded-[16px] bg-[#57E6D2] text-[#151936] font-display font-extrabold text-lg shadow-[0_6px_0_#2FA391] hover:translate-y-[2px] hover:shadow-[0_4px_0_#2FA391] active:translate-y-[2px] active:shadow-[0_4px_0_#2FA391] transition-all"
              >
                B is real
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="relative max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute -top-3 -right-3 z-10 rounded-full bg-[#1F2450] border border-white/10 hover:border-[#FF8552] p-2 transition-colors"
              >
                <X className="w-4 h-4 text-[#FFF8F0]" />
              </button>
              <img src={zoomedImage} alt="Zoomed" className="w-full max-h-[85vh] object-contain rounded-[16px]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameLayout>
  )
}

export default DailyChallenge
