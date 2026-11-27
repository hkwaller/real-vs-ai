// Future monetization boundary: only after the entire session has completed and final results are visible.
// Consult playam-monetization.monetizationBreakReached; no ad SDK or event is invoked here.
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import Seo from '@/components/Seo'
import { Check, Loader2, ZoomIn, X } from 'lucide-react'
import { ArrowRight } from '@/components/Brand'
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

  const seoPath = isToday ? '/daily' : `/daily/${date}`
  const seoTitle = isToday
    ? 'Daily Challenge - Real or AI'
    : `Daily Challenge · ${date} - Real or AI`
  const seoDescription =
    'A fresh Real-or-AI puzzle every day. Two photos, one is AI-generated - spot the fake in 15 seconds and keep your streak alive.'
  const seo = <Seo title={seoTitle} description={seoDescription} path={seoPath} />

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
      const schedule = await fetchSchedule(isToday ? date : undefined)
      if (!schedule || !schedule[date]) {
        setPhase('no_challenge')
        return
      }
      setRounds(buildRounds(date, schedule[date].images))
      setPhase('playing')
    }
    load()
  }, [date, isToday])

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
    const text = `Real vs AI - Daily challenge\n${correct}/${details.length} ${grid}\nCan you beat me? 🤖`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else navigator.clipboard.writeText(text)
  }

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <GameLayout>
        {seo}
        <div className="border-4 border-ink p-10 max-w-sm mx-auto text-center space-y-5">
          <Loader2 className="w-10 h-10 text-ink mx-auto animate-spin" strokeWidth={3} />
          <h1 className="type-display text-2xl leading-none">Loading daily challenge…</h1>
        </div>
      </GameLayout>
    )
  }

  // --- No challenge ---
  if (phase === 'no_challenge') {
    return (
      <GameLayout>
        {seo}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-4 border-ink p-8 max-w-md mx-auto text-center space-y-6"
        >
          <div>
            <h1 className="type-display text-4xl leading-[0.95]">No challenge today.</h1>
            <p className="font-medium text-text-muted mt-3">
              {isToday
                ? 'Check back for a new pair.'
                : `Nothing was scheduled for ${date}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              Home
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/daily/archive')}>
              Past challenges
            </Button>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  // --- Results (already done or just finished) - design 3h ---
  if ((phase === 'already_done' || phase === 'finished') && existingScore) {
    const details = existingScore.roundDetails ?? []
    const correctCount = details.filter((r) => r.correct).length
    const totalRounds = details.length || existingScore.rounds
    const streak = computeStreak()

    return (
      <GameLayout>
        {seo}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md mx-auto flex flex-col"
        >
          {/* Score field */}
          <div className="bg-side-a text-ink p-6 md:p-8">
            <p className="type-label text-sm">Daily challenge · {prettyDate(date)}</p>
            <h1 className="type-display text-[52px] md:text-[64px] leading-[0.9] mt-3">
              {correctCount} out of {totalRounds}.
            </h1>
          </div>
          <p className="font-semibold text-lg mt-5">
            {correctCount === totalRounds
              ? totalRounds === 1 ? 'You spotted the real photo.' : 'A perfect score. Incredible eye.'
              : correctCount >= totalRounds / 2
                ? 'Nice eye - the AI didn’t fool you much today.'
                : 'The AI got you today. Come back tomorrow.'}
          </p>

          {/* Result tiles */}
          <div className="flex items-center gap-2 mt-5">
            {details.map((rd, i) => (
              <div
                key={i}
                aria-label={rd.correct ? `Round ${i + 1}: right` : `Round ${i + 1}: fooled`}
                className={`w-12 h-12 flex items-center justify-center ${
                  rd.correct ? 'bg-side-a text-ink' : 'bg-ink text-paper'
                }`}
              >
                {rd.correct ? (
                  <Check className="w-6 h-6" strokeWidth={3} />
                ) : (
                  <X className="w-6 h-6" strokeWidth={3} />
                )}
              </div>
            ))}
          </div>

          {streak > 0 && (
            <p className="type-label text-sm self-start border-4 border-ink px-3 py-2 mt-5">
              {streak}-day streak
            </p>
          )}

          <div className="w-full mt-8 space-y-3">
            <Button size="lg" className="w-full px-4 text-lg sm:text-2xl" onClick={handleShare}>
              Challenge a friend
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowReview((v) => !v)}>
                {totalRounds === 1 ? 'Review the pair' : 'Review rounds'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                Home
              </Button>
            </div>
          </div>

          {isToday && (
            <p className="type-label text-sm text-text-muted mt-6">
              Next challenge in <span className="text-ink tabular-nums">{countdown}</span>
            </p>
          )}

          {/* Review rounds (toggle) */}
          <AnimatePresence>
            {showReview && details.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full mt-6 space-y-4 overflow-hidden text-left"
              >
                {details.map((rd, i) => {
                  const imgA = rd.isRealLeft ? rd.realImageUrl : rd.aiImageUrl
                  const imgB = rd.isRealLeft ? rd.aiImageUrl : rd.realImageUrl
                  return (
                    <div key={rd.roundId} className="border-4 border-ink p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="type-label text-sm">{totalRounds === 1 ? 'Image pair' : `Round ${i + 1}`}</span>
                        <span
                          className={`type-label text-xs px-2 py-1 ${
                            rd.correct ? 'bg-side-a text-ink' : 'bg-ink text-paper'
                          }`}
                        >
                          {rd.correct ? 'Right' : 'Fooled'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['A', 'B'] as const).map((opt) => {
                          const url = opt === 'A' ? imgA : imgB
                          const isReal = opt === rd.correctChoice
                          const realTag = opt === 'A' ? 'bg-side-a text-ink' : 'bg-side-b text-paper'
                          return (
                            <div
                              key={opt}
                              className="relative overflow-hidden border-4 border-ink aspect-[4/3]"
                            >
                              <img
                                src={url}
                                alt={`Option ${opt}`}
                                className="w-full h-full object-cover"
                              />
                              <span
                                className={`absolute bottom-0 left-0 px-2 py-1 type-label text-xs ${
                                  isReal ? realTag : 'bg-ink text-paper'
                                }`}
                              >
                                {isReal ? 'Real' : 'AI'}
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
      {seo}
      {/* Top strip */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3 border-b-2 border-ink pb-4">
        <span className="type-label text-sm">Daily challenge · {prettyDate(date)}</span>
        {rounds.length > 1 && (
          <div className="flex items-center gap-2">
            {squares.map((s, i) => (
              <div
                key={i}
                className={`w-4 h-4 ${
                  s === 'correct'
                    ? 'bg-side-a'
                    : s === 'wrong'
                      ? 'bg-ink'
                      : s === 'current'
                        ? 'border-4 border-ink bg-paper'
                        : 'border-2 border-text-placeholder bg-paper'
                }`}
              />
            ))}
          </div>
        )}
        {streak > 0 ? (
          <span className="type-label text-sm">{streak}-day streak</span>
        ) : rounds.length > 1 ? (
          <span className="type-label text-sm text-text-muted">
            Round {roundIndex + 1} of {rounds.length}
          </span>
        ) : null}
      </div>

      <h1 className="text-center type-display text-[32px] md:text-[44px] leading-none mb-6">
        Which one's real?
      </h1>

      <AnimatePresence mode="wait">
        {phase === 'reveal' && roundResult ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="grid grid-cols-2 gap-4 w-full">
              {(['A', 'B'] as const).map((opt) => {
                const url = opt === 'A' ? imageA : imageB
                const isReal = opt === roundResult.correctChoice
                const realBorder = opt === 'A' ? 'border-side-a' : 'border-side-b'
                const realTag = opt === 'A' ? 'bg-side-a text-ink' : 'bg-side-b text-paper'
                return (
                  <div
                    key={opt}
                    className={`relative overflow-hidden border-8 aspect-[4/3] ${
                      isReal ? realBorder : 'border-ink'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Option ${opt}`}
                      className="w-full h-full object-cover"
                      style={isReal ? undefined : { filter: 'saturate(.6) brightness(.8)' }}
                    />
                    <span
                      className={`absolute top-0 left-0 px-3 py-1.5 type-display text-sm md:text-base ${
                        isReal ? realTag : 'bg-ink text-paper'
                      }`}
                    >
                      {isReal ? 'Real' : 'AI'}
                    </span>
                  </div>
                )
              })}
            </div>

            <h2
              className={`type-display text-3xl md:text-4xl leading-none px-6 py-3 ${
                roundResult.correct ? 'bg-side-a text-ink' : 'bg-ink text-paper'
              }`}
            >
              {roundResult.correct ? 'Nailed it.' : 'Fooled.'}
            </h2>

            <Button size="lg" className="w-full max-w-sm" onClick={handleNext}>
              {roundIndex + 1 < rounds.length ? 'Next round' : 'See results'}
              <ArrowRight />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="grid grid-cols-2 gap-4 w-full">
              {(['A', 'B'] as const).map((opt) => {
                const url = opt === 'A' ? imageA : imageB
                const badge = opt === 'A' ? 'bg-side-a text-ink' : 'bg-side-b text-paper'
                return (
                  <motion.div
                    key={opt}
                    className="relative aspect-[4/3] cursor-zoom-in border-4 border-ink overflow-hidden"
                    onClick={() => setZoomedImage(url)}
                  >
                    <div
                      className={`absolute top-0 left-0 w-11 h-11 md:w-14 md:h-14 flex items-center justify-center type-display text-xl md:text-2xl z-20 ${badge}`}
                    >
                      {opt}
                    </div>
                    <img src={url} alt={`Option ${opt}`} className="w-full h-full object-cover" />
                    {opt === 'A' && (
                      <span className="absolute bottom-0 right-0 flex items-center gap-1.5 bg-ink text-paper px-3 py-1.5 type-label text-xs">
                        <ZoomIn className="w-3.5 h-3.5" strokeWidth={3} /> Tap to zoom
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={() => handleVote('A')}
                className="h-16 md:h-[72px] bg-side-a text-ink type-display text-base sm:text-xl md:text-2xl hover:brightness-[0.92] active:brightness-[0.84] transition-[filter] duration-150 cursor-pointer"
              >
                A is real
              </button>
              <button
                onClick={() => handleVote('B')}
                className="h-16 md:h-[72px] bg-side-b text-paper type-display text-base sm:text-xl md:text-2xl hover:brightness-[0.92] active:brightness-[0.84] transition-[filter] duration-150 cursor-pointer"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink p-4"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedImage(null)}
                aria-label="Close"
                className="absolute -top-3 -right-3 z-10 w-11 h-11 flex items-center justify-center bg-paper text-ink border-4 border-ink hover:brightness-[0.92] transition-[filter] cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={3} />
              </button>
              <img src={zoomedImage} alt="Zoomed" className="w-full max-h-[85vh] object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameLayout>
  )
}

export default DailyChallenge
