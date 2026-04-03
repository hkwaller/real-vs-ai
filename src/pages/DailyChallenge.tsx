import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import { Loader2, Trophy, Calendar, Share2, ArrowRight, Home } from 'lucide-react'
import {
  getTodayDate,
  fetchSchedule,
  buildRounds,
  getDailyScores,
  saveDailyScore,
  calcPoints,
  msUntilMidnight,
  formatCountdown,
  TIME_LIMIT,
  type DailyRound,
  type DailyScore,
} from '@/lib/dailyChallenge'

type Phase = 'loading' | 'no_challenge' | 'already_done' | 'playing' | 'reveal' | 'finished'

type RoundResult = {
  didVote: boolean
  correct: boolean
  correctChoice: 'A' | 'B'
  points: number
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
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [existingScore, setExistingScore] = useState<DailyScore | null>(null)
  const [countdown, setCountdown] = useState('')

  const roundStartTimeRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentRound = rounds[roundIndex] ?? null

  // Load schedule on mount
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

      const builtRounds = buildRounds(date, schedule[date].images)
      setRounds(builtRounds)
      setPhase('playing')
    }
    load()
  }, [date])

  // Countdown to midnight (for "already done" screen)
  useEffect(() => {
    if (phase !== 'already_done' || !isToday) return
    const tick = () => setCountdown(formatCountdown(msUntilMidnight()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, isToday])

  // Timer per round
  useEffect(() => {
    if (phase !== 'playing' || !currentRound) return

    roundStartTimeRef.current = Date.now()
    setTimeRemaining(TIME_LIMIT)
    setRoundResult(null)

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - roundStartTimeRef.current) / 1000
      const remaining = Math.max(0, Math.ceil(TIME_LIMIT - elapsed))
      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(timerRef.current!)
        const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
        const correctChoice: 'A' | 'B' = isRealLeft ? 'A' : 'B'
        setRoundResult({ didVote: false, correct: false, correctChoice, points: 0 })
        setPhase('reveal')
      }
    }, 250)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase === 'playing' ? currentRound?.id : null, phase])

  const handleVote = (choice: 'A' | 'B') => {
    if (phase !== 'playing' || !currentRound) return
    if (timerRef.current) clearInterval(timerRef.current)

    const elapsed = (Date.now() - roundStartTimeRef.current) / 1000
    const remaining = Math.max(0, TIME_LIMIT - elapsed)

    const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
    const correctChoice: 'A' | 'B' = isRealLeft ? 'A' : 'B'
    const correct = choice === correctChoice
    const points = correct ? calcPoints(remaining) : 0

    setRoundResult({ didVote: true, correct, correctChoice, points })
    setScore((s) => s + points)
    setPhase('reveal')
  }

  const handleNext = () => {
    const nextIndex = roundIndex + 1
    if (nextIndex >= rounds.length) {
      const maxScore = rounds.length * 100
      const result: DailyScore = {
        score,
        maxScore,
        rounds: rounds.length,
        completedAt: new Date().toISOString(),
      }
      saveDailyScore(date, result)
      setExistingScore(result)
      setPhase('finished')
    } else {
      setRoundIndex(nextIndex)
      setPhase('playing')
    }
  }

  const shareText = existingScore
    ? `I scored ${existingScore.score}/${existingScore.maxScore} on the Real vs AI Daily Challenge! Can you beat me? 🤖`
    : ''

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: shareText })
    } else {
      navigator.clipboard.writeText(shareText)
    }
  }

  // --- Phases ---

  if (phase === 'loading') {
    return (
      <GameLayout>
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 max-w-sm mx-auto text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#FFB830] mx-auto animate-spin" />
          <div>
            <p className="mission-label mb-1">Standby</p>
            <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
              Loading Challenge
            </h1>
          </div>
        </div>
      </GameLayout>
    )
  }

  if (phase === 'no_challenge') {
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-md"
        >
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 w-full space-y-5">
            <Calendar className="w-14 h-14 text-[#FFB830] mx-auto" />
            <div>
              <p className="mission-label mb-2">Status</p>
              <h1 className="font-orbitron text-3xl font-black text-[#FF6B1A] uppercase">
                No Mission Today
              </h1>
              <p className="text-[#8B97C8] mt-2 text-sm">
                {isToday
                  ? "No daily challenge scheduled. Check back tomorrow."
                  : `No challenge was scheduled for ${date}.`}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/daily/archive">Past Challenges</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  if (phase === 'already_done' && existingScore) {
    const pct = Math.round((existingScore.score / existingScore.maxScore) * 100)
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-md w-full"
        >
          <div className="corner-bracket bg-[#111840] border border-[#FFB830]/50 p-10 w-full space-y-5">
            <Trophy className="w-14 h-14 text-[#FFB830] mx-auto" />
            <div>
              <p className="mission-label mb-2">Debrief</p>
              <h1 className="font-orbitron text-3xl font-black text-[#FF6B1A] uppercase">
                Already Completed
              </h1>
              <p className="text-[#8B97C8] mt-2 text-sm">
                {isToday
                  ? "You've already done today's challenge."
                  : `Completed on ${new Date(existingScore.completedAt).toLocaleDateString()}.`}
              </p>
            </div>

            <div className="border border-[#2A3468] bg-[#0B0F2E] p-6 text-center space-y-3">
              <div className="font-space-mono text-5xl font-bold text-[#FFB830]">
                {existingScore.score}
                <span className="text-2xl text-[#8B97C8] font-normal">/{existingScore.maxScore}</span>
              </div>
              <p className="mission-label">{pct}% Accuracy</p>
              <div className="w-full bg-[#1A2355] h-2">
                <div
                  className="bg-[#FFB830] h-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {isToday && (
              <div className="text-center space-y-1">
                <p className="mission-label">Next Challenge In</p>
                <p className="font-space-mono text-2xl font-bold text-[#00FFE5]">{countdown}</p>
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Score
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/daily/archive">Past Challenges</Link>
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </div>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  if (phase === 'finished' && existingScore) {
    const pct = Math.round((existingScore.score / existingScore.maxScore) * 100)
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center max-w-md w-full"
        >
          <div className="corner-bracket bg-[#111840] border border-[#FFB830]/50 p-10 w-full space-y-5">
            <Trophy className="w-14 h-14 text-[#FFB830] mx-auto" />
            <div>
              <p className="mission-label mb-2">Debrief</p>
              <h1 className="font-orbitron text-3xl font-black text-[#FF6B1A] uppercase">
                Mission Complete
              </h1>
              <p className="text-[#8B97C8] mt-1 font-space-mono text-xs">{date}</p>
            </div>

            <div className="border border-[#2A3468] bg-[#0B0F2E] p-6 text-center space-y-3">
              <div className="font-space-mono text-5xl font-bold text-[#FFB830]">
                {existingScore.score}
                <span className="text-2xl text-[#8B97C8] font-normal">/{existingScore.maxScore}</span>
              </div>
              <p className="mission-label">{pct}% Accuracy</p>
              <div className="w-full bg-[#1A2355] h-2">
                <div
                  className="bg-[#FFB830] h-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {isToday && (
              <div className="text-center space-y-1">
                <p className="mission-label">Next Challenge In</p>
                <p className="font-space-mono text-2xl font-bold text-[#00FFE5]">{countdown}</p>
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Result
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/daily/archive">Past Challenges</Link>
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </div>
          </div>
        </motion.div>
      </GameLayout>
    )
  }

  if (!currentRound) return null

  const isRealLeft = currentRound.id.charCodeAt(0) % 2 === 0
  const imageA = isRealLeft ? currentRound.realImageUrl : currentRound.aiImageUrl
  const imageB = isRealLeft ? currentRound.aiImageUrl : currentRound.realImageUrl

  return (
    <GameLayout>
      <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-[#FFB830] mb-1">
            <Calendar className="w-4 h-4" />
            <span className="font-space-mono text-xs font-bold tracking-widest uppercase">
              {isToday ? "Today's Challenge" : date}
            </span>
          </div>
          <h1 className="font-orbitron text-3xl font-black text-[#F5F0E8] uppercase tracking-tight">
            Which is Real?
          </h1>
          <p className="mission-label">Round {roundIndex + 1} of {rounds.length}</p>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'reveal' && roundResult ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-4"
            >
              {/* Images with answer overlay */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {(['A', 'B'] as const).map((option, i) => {
                  const imgUrl = i === 0 ? imageA : imageB
                  const isReal = i === 0 ? isRealLeft : !isRealLeft
                  return (
                    <div
                      key={option}
                      className={`relative overflow-hidden border-2 ${
                        isReal ? 'border-[#00FFE5]' : 'border-[#FF3D1A]'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Option ${option}`}
                        className="w-full aspect-square object-cover"
                      />
                      <div
                        className={`absolute inset-0 flex items-end justify-center pb-3 ${
                          isReal ? 'bg-[#00FFE5]/10' : 'bg-[#FF3D1A]/10'
                        }`}
                      >
                        <span
                          className={`font-space-mono text-xs font-bold px-3 py-1 ${
                            isReal
                              ? 'bg-[#00FFE5]/80 text-[#0B0F2E]'
                              : 'bg-[#FF3D1A]/80 text-white'
                          }`}
                        >
                          {isReal ? '✓ REAL' : '✗ AI'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Result card */}
              <div
                className={`corner-bracket w-full text-center py-6 px-6 border-2 space-y-3 ${
                  !roundResult.didVote
                    ? 'border-[#FFB830] bg-[#FFB830]/10'
                    : roundResult.correct
                      ? 'border-[#00FFE5] bg-[#00FFE5]/10'
                      : 'border-[#FF3D1A] bg-[#FF3D1A]/10'
                }`}
              >
                <div className="text-5xl">
                  {!roundResult.didVote ? '⏰' : roundResult.correct ? '✅' : '❌'}
                </div>
                <h2
                  className={`font-orbitron text-2xl font-black uppercase ${
                    !roundResult.didVote
                      ? 'text-[#FFB830]'
                      : roundResult.correct
                        ? 'text-[#00FFE5]'
                        : 'text-[#FF3D1A]'
                  }`}
                >
                  {!roundResult.didVote ? 'Too Slow' : roundResult.correct ? 'Correct' : 'Wrong'}
                </h2>
                {roundResult.correct && (
                  <div className="border border-[#FFB830]/50 bg-[#FFB830]/10 px-5 py-1 inline-block">
                    <span className="font-space-mono font-bold text-xl text-[#FFB830]">
                      +{roundResult.points} PTS
                    </span>
                  </div>
                )}
              </div>

              <Button size="lg" className="w-full" onClick={handleNext}>
                {roundIndex + 1 < rounds.length ? (
                  <>
                    Next Round
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    See Results
                    <Trophy className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center gap-4"
            >
              {/* Timer + Score bar */}
              <div className="flex items-center justify-between w-full px-1">
                <div>
                  <p className="mission-label mb-0.5">Score</p>
                  <span className="font-space-mono text-lg font-bold text-[#FFB830]">{score}</span>
                </div>
                <div className="text-right">
                  <p className="mission-label mb-0.5">Time</p>
                  <span
                    className={`font-space-mono text-3xl font-bold tabular-nums ${
                      timeRemaining <= 5 ? 'text-[#FF3D1A] animate-pulse' : 'text-[#FF6B1A]'
                    }`}
                  >
                    {timeRemaining}
                  </span>
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {(['A', 'B'] as const).map((option, i) => {
                  const imgUrl = i === 0 ? imageA : imageB
                  return (
                    <motion.button
                      key={option}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleVote(option)}
                      className="relative overflow-hidden border-2 border-[#2A3468] hover:border-[#FF6B1A] hover:shadow-[0_0_20px_rgba(255,107,26,0.3)] transition-all"
                    >
                      <img
                        src={imgUrl}
                        alt={`Option ${option}`}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-[#0B0F2E]/80 py-2 text-center border-t border-[#2A3468]">
                        <span className="font-orbitron text-2xl font-black text-[#FF6B1A]">{option}</span>
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GameLayout>
  )
}

export default DailyChallenge
