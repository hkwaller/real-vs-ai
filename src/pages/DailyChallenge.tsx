import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
      // Check if already completed
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
        // Time's up — reveal with no vote
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
      // Game over — save score
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
        <Card className="text-center p-10 border-0">
          <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold">Loading challenge...</h1>
        </Card>
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
          <Calendar className="w-16 h-16 text-amber-400" />
          <div>
            <h1 className="text-3xl font-bold mb-2">No Challenge Today</h1>
            <p className="text-muted-foreground">
              {isToday
                ? "There's no daily challenge scheduled for today. Check back tomorrow!"
                : `No challenge was scheduled for ${date}.`}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <Button variant="outline" asChild>
              <Link to="/daily/archive">Past Challenges</Link>
            </Button>
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
          <Trophy className="w-16 h-16 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold mb-1">Already Completed!</h1>
            <p className="text-muted-foreground">
              {isToday ? "You've already done today's challenge." : `You completed this challenge on ${new Date(existingScore.completedAt).toLocaleDateString()}.`}
            </p>
          </div>

          <Card className="w-full p-6 text-center">
            <div className="text-5xl font-black text-amber-400 mb-1">
              {existingScore.score}
              <span className="text-2xl text-muted-foreground">/{existingScore.maxScore}</span>
            </div>
            <div className="text-sm text-muted-foreground mb-3">{pct}% accuracy</div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-400 to-orange-400 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Card>

          {isToday && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Next challenge in</p>
              <p className="text-2xl font-mono font-bold text-amber-400">{countdown}</p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Score
            </Button>
            <Button variant="outline" asChild>
              <Link to="/daily/archive">Past Challenges</Link>
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
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
          <Trophy className="w-16 h-16 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold mb-1">Challenge Complete!</h1>
            <p className="text-muted-foreground">{date}</p>
          </div>

          <Card className="w-full p-6 text-center">
            <div className="text-5xl font-black text-amber-400 mb-1">
              {existingScore.score}
              <span className="text-2xl text-muted-foreground">/{existingScore.maxScore}</span>
            </div>
            <div className="text-sm text-muted-foreground mb-3">{pct}% accuracy</div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-400 to-orange-400 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Card>

          {isToday && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Next challenge in</p>
              <p className="text-2xl font-mono font-bold text-amber-400">{countdown}</p>
            </div>
          )}

          <div className="flex gap-3 flex-wrap justify-center">
            <Button
              variant="neon"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Result
            </Button>
            <Button variant="outline" asChild>
              <Link to="/daily/archive">Past Challenges</Link>
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
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
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">{isToday ? "Today's Challenge" : date}</span>
          </div>
          <h1 className="text-3xl font-bold">Which is REAL?</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Round {roundIndex + 1} of {rounds.length}
          </p>
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
                    <div key={option} className="relative rounded-xl overflow-hidden">
                      <img
                        src={imgUrl}
                        alt={`Option ${option}`}
                        className="w-full aspect-square object-cover"
                      />
                      <div
                        className={`absolute inset-0 flex items-end justify-center pb-3 ${
                          isReal ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}
                      >
                        <span
                          className={`text-sm font-bold px-3 py-1 rounded-full ${
                            isReal
                              ? 'bg-green-500/80 text-white'
                              : 'bg-red-500/80 text-white'
                          }`}
                        >
                          {isReal ? '✓ Real' : '✗ AI'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Result card */}
              <Card
                className={`w-full text-center py-6 border-2 ${
                  !roundResult.didVote
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : roundResult.correct
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-red-500/50 bg-red-500/10'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="text-5xl">
                    {!roundResult.didVote ? '⏰' : roundResult.correct ? '✅' : '❌'}
                  </div>
                  <h2
                    className={`text-2xl font-black ${
                      !roundResult.didVote
                        ? 'text-yellow-400'
                        : roundResult.correct
                          ? 'text-green-400'
                          : 'text-red-400'
                    }`}
                  >
                    {!roundResult.didVote ? 'Too slow!' : roundResult.correct ? 'Correct!' : 'Wrong!'}
                  </h2>
                  {roundResult.correct && (
                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-full px-5 py-1">
                      <span className="text-yellow-400 font-black text-xl">
                        +{roundResult.points} pts
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <Button variant="neon" size="lg" className="w-full" onClick={handleNext}>
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
              {/* Timer */}
              <div className="flex items-center justify-between w-full px-1">
                <span className="text-sm text-muted-foreground">
                  Score: <span className="text-white font-bold">{score}</span>
                </span>
                <span
                  className={`text-lg font-mono font-bold tabular-nums ${
                    timeRemaining <= 5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                  }`}
                >
                  {timeRemaining}s
                </span>
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
                      className="relative rounded-xl overflow-hidden border-2 border-white/10 hover:border-amber-400/50 transition-colors"
                    >
                      <img
                        src={imgUrl}
                        alt={`Option ${option}`}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-2 text-center">
                        <span className="text-2xl font-black">{option}</span>
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
