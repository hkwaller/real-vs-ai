import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import { Loader2, Trophy, Calendar, Share2, ArrowRight, Home, ZoomIn, X } from 'lucide-react'
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

  // Reset round state when a new round starts
  useEffect(() => {
    if (phase !== 'playing') return
    setRoundResult(null)
  }, [phase === 'playing' ? currentRound?.id : null, phase])

  // Close lightbox on Escape
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
      const maxScore = rounds.length * 100
      const result: DailyScore = {
        score,
        maxScore,
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

  const existingCorrect = existingScore?.roundDetails?.filter((r) => r.correct).length ?? 0
  const existingTotal = existingScore?.roundDetails?.length ?? existingScore?.rounds ?? 0

  const shareText = existingScore
    ? `I got ${existingCorrect}/${existingTotal} correct on the Real vs AI Daily Challenge! Can you beat me? 🤖`
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
                  ? 'No daily challenge scheduled. Check back tomorrow.'
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
    const details = existingScore.roundDetails ?? []
    const correctCount = details.filter((r) => r.correct).length
    const totalRounds = details.length || existingScore.rounds
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 text-center max-w-lg w-full"
        >
          <div className="corner-bracket bg-[#111840] border border-[#FFB830]/50 p-8 w-full space-y-5">
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
                {correctCount}
                <span className="text-2xl text-[#8B97C8] font-normal">/{totalRounds}</span>
              </div>
              <p className="mission-label">correct</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {details.map((rd, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 flex items-center justify-center text-sm font-bold ${
                      rd.correct
                        ? 'bg-[#00FFE5]/20 text-[#00FFE5] border border-[#00FFE5]/40'
                        : 'bg-[#FF3D1A]/20 text-[#FF3D1A] border border-[#FF3D1A]/40'
                    }`}
                  >
                    {rd.correct ? '✓' : '✗'}
                  </div>
                ))}
              </div>
            </div>

            {/* Round-by-round recap */}
            {details.length > 0 && (
              <div className="space-y-3 text-left">
                <p className="mission-label text-center">Round Recap</p>
                {details.map((rd, i) => {
                  const imgA = rd.isRealLeft ? rd.realImageUrl : rd.aiImageUrl
                  const imgB = rd.isRealLeft ? rd.aiImageUrl : rd.realImageUrl
                  const isRealA = rd.isRealLeft
                  return (
                    <div
                      key={rd.roundId}
                      className="border border-[#2A3468] bg-[#0B0F2E]/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-space-mono text-xs text-[#8B97C8]">
                          Round {i + 1}
                        </span>
                        <span
                          className={`font-space-mono text-xs font-bold ${
                            rd.correct ? 'text-[#00FFE5]' : 'text-[#FF3D1A]'
                          }`}
                        >
                          {rd.correct ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['A', 'B'] as const).map((opt) => {
                          const imgUrl = opt === 'A' ? imgA : imgB
                          const isReal = opt === 'A' ? isRealA : !isRealA
                          const wasChosen = rd.playerChoice === opt
                          return (
                            <div
                              key={opt}
                              className={`relative overflow-hidden border-2 ${
                                wasChosen
                                  ? rd.correct
                                    ? 'border-[#00FFE5]'
                                    : 'border-[#FF3D1A]'
                                  : rd.correctChoice === opt
                                    ? 'border-[#00FFE5]/40'
                                    : 'border-[#2A3468]'
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`Option ${opt}`}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className={`absolute inset-0 flex flex-col items-center justify-between p-1.5 ${isReal ? 'bg-[#00FFE5]/5' : 'bg-[#FF3D1A]/5'}`}
                              >
                                <span
                                  className={`font-orbitron text-xs font-black self-start ${wasChosen ? 'text-white' : 'text-white/50'}`}
                                >
                                  {opt}
                                </span>
                                <div className="flex items-center gap-1">
                                  {wasChosen && (
                                    <span
                                      className={`font-space-mono text-[9px] font-bold px-1.5 py-0.5 ${rd.correct ? 'bg-[#00FFE5]/80 text-[#0B0F2E]' : 'bg-[#FF3D1A]/80 text-white'}`}
                                    >
                                      YOUR PICK
                                    </span>
                                  )}
                                  <span
                                    className={`font-space-mono text-[9px] font-bold px-1.5 py-0.5 ${isReal ? 'bg-[#00FFE5]/70 text-[#0B0F2E]' : 'bg-[#1A2355] text-[#8B97C8]'}`}
                                  >
                                    {isReal ? 'REAL' : 'AI'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

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
    const details = existingScore.roundDetails ?? []
    const correctCount = details.filter((r) => r.correct).length
    const totalRounds = details.length || existingScore.rounds
    return (
      <GameLayout>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center max-w-lg w-full"
        >
          <div className="corner-bracket bg-[#111840] border border-[#FFB830]/50 p-8 w-full space-y-5">
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
                {correctCount}
                <span className="text-2xl text-[#8B97C8] font-normal">/{totalRounds}</span>
              </div>
              <p className="mission-label">correct</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {details.map((rd, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 flex items-center justify-center text-sm font-bold ${
                      rd.correct
                        ? 'bg-[#00FFE5]/20 text-[#00FFE5] border border-[#00FFE5]/40'
                        : 'bg-[#FF3D1A]/20 text-[#FF3D1A] border border-[#FF3D1A]/40'
                    }`}
                  >
                    {rd.correct ? '✓' : '✗'}
                  </div>
                ))}
              </div>
            </div>

            {/* Round-by-round recap */}
            {details.length > 0 && (
              <div className="space-y-3 text-left">
                <p className="mission-label text-center">Round Recap</p>
                {details.map((rd, i) => {
                  const imgA = rd.isRealLeft ? rd.realImageUrl : rd.aiImageUrl
                  const imgB = rd.isRealLeft ? rd.aiImageUrl : rd.realImageUrl
                  const isRealA = rd.isRealLeft
                  return (
                    <div
                      key={rd.roundId}
                      className="border border-[#2A3468] bg-[#0B0F2E]/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-space-mono text-xs text-[#8B97C8]">
                          Round {i + 1}
                        </span>
                        <span
                          className={`font-space-mono text-xs font-bold ${
                            rd.correct ? 'text-[#00FFE5]' : 'text-[#FF3D1A]'
                          }`}
                        >
                          {rd.correct ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['A', 'B'] as const).map((opt) => {
                          const imgUrl = opt === 'A' ? imgA : imgB
                          const isReal = opt === 'A' ? isRealA : !isRealA
                          const wasChosen = rd.playerChoice === opt
                          return (
                            <div
                              key={opt}
                              className={`relative overflow-hidden border-2 ${
                                wasChosen
                                  ? rd.correct
                                    ? 'border-[#00FFE5]'
                                    : 'border-[#FF3D1A]'
                                  : rd.correctChoice === opt
                                    ? 'border-[#00FFE5]/40'
                                    : 'border-[#2A3468]'
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`Option ${opt}`}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className={`absolute inset-0 flex flex-col items-center justify-between p-1.5 ${isReal ? 'bg-[#00FFE5]/5' : 'bg-[#FF3D1A]/5'}`}
                              >
                                <span
                                  className={`font-orbitron text-xs font-black self-start ${wasChosen ? 'text-white' : 'text-white/50'}`}
                                >
                                  {opt}
                                </span>
                                <div className="flex items-center gap-1">
                                  {wasChosen && (
                                    <span
                                      className={`font-space-mono text-[9px] font-bold px-1.5 py-0.5 ${rd.correct ? 'bg-[#00FFE5]/80 text-[#0B0F2E]' : 'bg-[#FF3D1A]/80 text-white'}`}
                                    >
                                      YOUR PICK
                                    </span>
                                  )}
                                  <span
                                    className={`font-space-mono text-[9px] font-bold px-1.5 py-0.5 ${isReal ? 'bg-[#00FFE5]/70 text-[#0B0F2E]' : 'bg-[#1A2355] text-[#8B97C8]'}`}
                                  >
                                    {isReal ? 'REAL' : 'AI'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

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
    <GameLayout className="max-w-screen p-8">
      <div className="flex flex-col items-center gap-6 w-full mx-auto">
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
          <p className="mission-label">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
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
                        className="w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 flex items-end justify-center pb-3 ${
                          isReal ? 'bg-[#00FFE5]/10' : 'bg-[#FF3D1A]/10'
                        }`}
                      >
                        <span
                          className={`font-space-mono text-xs font-bold px-3 py-1 ${
                            isReal ? 'bg-[#00FFE5]/80 text-[#0B0F2E]' : 'bg-[#FF3D1A]/80 text-white'
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
                  roundResult.correct
                    ? 'border-[#00FFE5] bg-[#00FFE5]/10'
                    : 'border-[#FF3D1A] bg-[#FF3D1A]/10'
                }`}
              >
                <div className="text-5xl">{roundResult.correct ? '✅' : '❌'}</div>
                <h2
                  className={`font-orbitron text-2xl font-black uppercase ${
                    roundResult.correct ? 'text-[#00FFE5]' : 'text-[#FF3D1A]'
                  }`}
                >
                  {roundResult.correct ? 'Correct' : 'Wrong'}
                </h2>
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
              {/* Images — click to zoom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {(['A', 'B'] as const).map((option, i) => {
                  const imgUrl = i === 0 ? imageA : imageB
                  return (
                    <motion.div
                      key={option}
                      whileHover={{ scale: 1.02 }}
                      className="relative overflow-hidden border-2 border-[#2A3468] hover:border-[#FFB830] hover:shadow-[0_0_20px_rgba(255,184,48,0.25)] transition-all cursor-zoom-in group"
                      onClick={() => setZoomedImage(imgUrl)}
                    >
                      <img
                        src={imgUrl}
                        alt={`Option ${option}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-[#0B0F2E]/80 px-2 py-1 border border-[#2A3468]">
                        <span className="font-orbitron text-sm font-black text-[#FF6B1A]">
                          {option}
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[#0B0F2E]/30">
                        <ZoomIn className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Zoom hint */}
              <div className="flex items-center justify-center gap-1.5 text-[#8B97C8]">
                <ZoomIn className="w-3.5 h-3.5" />
                <span className="font-space-mono text-xs">Tap image to zoom in</span>
              </div>

              {/* Vote buttons */}
              <div className="w-full space-y-2">
                <p className="font-orbitron text-xl font-black text-[#FF6B1A] uppercase tracking-widest text-center">
                  Which is Real?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {(['A', 'B'] as const).map((option) => (
                    <motion.button
                      key={option}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleVote(option)}
                      className="border-2 border-[#FF6B1A] bg-[#FF6B1A]/10 hover:bg-[#FF6B1A]/25 hover:shadow-[0_0_20px_rgba(255,107,26,0.35)] transition-all py-3 px-4 text-center"
                    >
                      <span className="font-space-mono text-2xl font-bold text-[#F5F0E8]">
                        {option}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox zoom overlay */}
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
                className="absolute -top-3 -right-3 z-10 bg-[#111840] border border-[#2A3468] hover:border-[#FF6B1A] p-1.5 transition-colors"
              >
                <X className="w-4 h-4 text-[#F5F0E8]" />
              </button>
              <img
                src={zoomedImage}
                alt="Zoomed"
                className="w-full max-h-[85vh] object-contain border-2 border-[#2A3468]"
              />
              <p className="text-center font-space-mono text-xs text-[#8B97C8] mt-2">
                Click outside or press Esc to close
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GameLayout>
  )
}

export default DailyChallenge
