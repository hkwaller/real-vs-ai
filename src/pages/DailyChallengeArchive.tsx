import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import { Loader2, Calendar, Trophy, Home, Play, CheckCircle2, XCircle } from 'lucide-react'
import {
  fetchSchedule,
  getDailyScores,
  getTodayDate,
  type DailySchedule,
  type DailyScores,
  type RoundDetail,
} from '@/lib/dailyChallenge'

type ChallengeEntry = {
  date: string
  available: boolean
  score?: number
  maxScore?: number
  roundDetails?: RoundDetail[]
  completedAt?: string
}

const DailyChallengeArchive: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<ChallengeEntry[]>([])

  useEffect(() => {
    async function load() {
      const [schedule, scores]: [DailySchedule | null, DailyScores] = await Promise.all([
        fetchSchedule(),
        Promise.resolve(getDailyScores()),
      ])

      const today = getTodayDate()
      const allDates = new Set<string>([
        ...Object.keys(schedule ?? {}),
        ...Object.keys(scores),
      ])

      const sorted = Array.from(allDates).sort((a, b) => b.localeCompare(a))

      const built: ChallengeEntry[] = sorted.map((date) => {
        const inSchedule = !!schedule?.[date]
        const dayScore = scores[date]
        return {
          date,
          available: inSchedule || !!dayScore,
          score: dayScore?.score,
          maxScore: dayScore?.maxScore ?? (schedule?.[date]?.images.length ?? 5) * 100,
          roundDetails: dayScore?.roundDetails,
          completedAt: dayScore?.completedAt,
        }
      })

      setEntries(built.filter((e) => e.date <= today))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <GameLayout>
        <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-10 max-w-sm mx-auto text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#FFB830] mx-auto animate-spin" />
          <div>
            <p className="mission-label mb-1">Accessing Archives</p>
            <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase">
              Loading Archive
            </h1>
          </div>
        </div>
      </GameLayout>
    )
  }

  const today = getTodayDate()

  return (
    <GameLayout>
      <div className="flex flex-col items-center gap-6 w-full">
        {/* Header */}
        <div className="text-center w-full">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-[#FFB830]" />
            <p className="mission-label">Archive</p>
          </div>
          <h1 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase tracking-wide">
            Past Missions
          </h1>
          <p className="text-[#8B97C8] text-sm mt-1">Browse and replay past challenges</p>
        </div>

        {entries.length === 0 ? (
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-8 w-full text-center">
            <p className="text-[#8B97C8] font-space-mono text-sm">// No challenges available yet.</p>
          </div>
        ) : (
          <motion.div
            className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.05 } },
            }}
          >
            {entries.map((entry) => {
              const isToday = entry.date === today
              const completed = entry.roundDetails !== undefined && entry.roundDetails.length > 0
              const roundDetails = entry.roundDetails ?? []
              const correctCount = roundDetails.filter((r) => r.correct).length
              const totalRounds = roundDetails.length || (entry.maxScore ? entry.maxScore / 100 : 0)
              const displayDate = isToday
                ? "Today's Challenge"
                : new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })

              const thumbnails = roundDetails
                .slice(0, 3)
                .map((rd) => rd.realImageUrl)

              return (
                <motion.div
                  key={entry.date}
                  variants={{
                    hidden: { opacity: 0, y: 12 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  {completed ? (
                    /* --- Completed card --- */
                    <div
                      className={`bg-[#111840] border h-full flex flex-col cursor-pointer hover:border-[#FFB830]/60 transition-colors ${
                        isToday ? 'border-[#FFB830]/50' : 'border-[#2A3468]'
                      }`}
                      onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                    >
                      {/* Thumbnail strip */}
                      {thumbnails.length > 0 && (
                        <div className="grid grid-cols-3 h-28 overflow-hidden">
                          {thumbnails.map((url, i) => (
                            <div key={i} className="relative overflow-hidden">
                              <img
                                src={url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              {/* per-thumb result indicator */}
                              <div className="absolute bottom-1 right-1">
                                {roundDetails[i].correct ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#00FFE5] drop-shadow" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-[#FF3D1A] drop-shadow" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Card body */}
                      <div className="p-4 flex flex-col gap-3 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-orbitron text-sm font-bold text-[#F5F0E8] uppercase tracking-wide leading-tight">
                              {displayDate}
                            </p>
                            <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">{entry.date}</p>
                          </div>
                          <Trophy className="w-4 h-4 text-[#FFB830] shrink-0 mt-0.5" />
                        </div>

                        {/* Per-round indicators */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {roundDetails.map((rd, i) => (
                            <div
                              key={i}
                              className={`w-5 h-5 flex items-center justify-center text-xs font-bold font-space-mono ${
                                rd.correct
                                  ? 'bg-[#00FFE5]/20 text-[#00FFE5] border border-[#00FFE5]/40'
                                  : 'bg-[#FF3D1A]/20 text-[#FF3D1A] border border-[#FF3D1A]/40'
                              }`}
                            >
                              {rd.correct ? '✓' : '✗'}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-auto">
                          <span className="font-space-mono text-sm font-bold text-[#FFB830]">
                            {correctCount}/{totalRounds} correct
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-3"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(isToday ? '/daily' : `/daily/${entry.date}`)
                            }}
                          >
                            View Recap
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* --- Unplayed card --- */
                    <div
                      className={`bg-[#111840] border h-full flex flex-col ${
                        isToday ? 'border-[#FF6B1A]/60' : 'border-[#2A3468]'
                      }`}
                    >
                      {/* Placeholder area */}
                      <div className="h-28 bg-[#0B0F2E] flex items-center justify-center border-b border-[#2A3468]">
                        <div className="text-center space-y-1">
                          <Calendar className="w-8 h-8 text-[#2A3468] mx-auto" />
                          <p className="font-space-mono text-xs text-[#2A3468]">Not played</p>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 flex flex-col gap-3 flex-1">
                        <div>
                          <p className="font-orbitron text-sm font-bold text-[#F5F0E8] uppercase tracking-wide leading-tight">
                            {displayDate}
                          </p>
                          <p className="font-space-mono text-xs text-[#8B97C8] mt-0.5">{entry.date}</p>
                        </div>

                        {isToday && (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B1A] animate-pulse" />
                            <span className="font-space-mono text-xs text-[#FF6B1A]">Active Today</span>
                          </div>
                        )}

                        <div className="mt-auto">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                          >
                            <Play className="w-3.5 h-3.5 mr-1.5" />
                            {isToday ? 'Play Now' : 'Start Challenge'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}

        <Button variant="outline" onClick={() => navigate('/')}>
          <Home className="w-4 h-4 mr-2" />
          Home
        </Button>
      </div>
    </GameLayout>
  )
}

export default DailyChallengeArchive
