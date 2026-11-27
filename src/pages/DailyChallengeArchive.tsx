import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import GameLayout from '@/components/GameLayout'
import Seo from '@/components/Seo'
import { Loader2, Calendar, Trophy, Home, Play, Check, X } from 'lucide-react'
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
      const today = getTodayDate()
      const [schedule, scores]: [DailySchedule | null, DailyScores] = await Promise.all([
        fetchSchedule(today),
        Promise.resolve(getDailyScores()),
      ])

      const allDates = new Set<string>([...Object.keys(schedule ?? {}), ...Object.keys(scores)])

      const sorted = Array.from(allDates).sort((a, b) => b.localeCompare(a))

      const built: ChallengeEntry[] = sorted.map((date) => {
        const inSchedule = !!schedule?.[date]
        const dayScore = scores[date]
        return {
          date,
          available: inSchedule || !!dayScore,
          score: dayScore?.score,
          maxScore: dayScore?.maxScore ?? (schedule?.[date]?.images.length ?? 1) * 100,
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
        <Seo
          title="Daily Challenge Archive - Real or AI"
          description="Browse and replay every past Real-or-AI daily challenge. See if you can still spot the AI-generated photo."
          path="/daily/archive"
        />
        <div className="border-4 border-ink p-10 max-w-sm mx-auto text-center space-y-5">
          <Loader2 className="w-10 h-10 text-ink mx-auto animate-spin" strokeWidth={3} />
          <div>
            <p className="type-label text-sm text-text-muted mb-2">Archive</p>
            <h1 className="type-display text-2xl leading-none">Loading archive…</h1>
          </div>
        </div>
      </GameLayout>
    )
  }

  const today = getTodayDate()

  return (
    <GameLayout>
      <Seo
        title="Daily Challenge Archive - Real or AI"
        description="Browse and replay every past Real-or-AI daily challenge. See if you can still spot the AI-generated photo."
        path="/daily/archive"
      />
      <div className="flex flex-col items-center gap-8 w-full">
        {/* Header */}
        <div className="w-full border-b-4 border-ink pb-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-ink" strokeWidth={2.5} />
            <p className="type-label text-sm">Archive</p>
          </div>
          <h1 className="type-display text-4xl md:text-5xl leading-[0.95]">Past challenges.</h1>
          <p className="font-medium text-text-muted mt-2">Browse and replay past challenges.</p>
        </div>

        {entries.length === 0 ? (
          <div className="border-4 border-ink p-8 w-full text-center">
            <p className="font-medium text-text-muted">No challenges available yet.</p>
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

              const thumbnails = roundDetails.slice(0, 3).map((rd) => rd.realImageUrl)

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
                      className="bg-paper border-4 border-ink h-full flex flex-col cursor-pointer hover:border-side-b transition-colors"
                      onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                    >
                      {/* Thumbnail strip */}
                      {thumbnails.length > 0 && (
                        <div className="grid grid-cols-3 h-28 overflow-hidden border-b-4 border-ink">
                          {thumbnails.map((url, i) => (
                            <div key={i} className="relative overflow-hidden">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              {/* per-thumb result indicator */}
                              <div
                                className={`absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center ${
                                  roundDetails[i].correct ? 'bg-side-a text-ink' : 'bg-ink text-paper'
                                }`}
                              >
                                {roundDetails[i].correct ? (
                                  <Check className="w-4 h-4" strokeWidth={3} />
                                ) : (
                                  <X className="w-4 h-4" strokeWidth={3} />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Card body */}
                      <div className="p-4 flex flex-col gap-4 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="type-display text-base leading-tight">{displayDate}</p>
                            <p className="type-label text-xs text-text-muted mt-1">{entry.date}</p>
                          </div>
                          <Trophy className="w-5 h-5 text-ink shrink-0" strokeWidth={2.5} />
                        </div>

                        {/* Per-round indicators */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {roundDetails.map((rd, i) => (
                            <div
                              key={i}
                              className={`w-6 h-6 flex items-center justify-center ${
                                rd.correct ? 'bg-side-a text-ink' : 'bg-ink text-paper'
                              }`}
                            >
                              {rd.correct ? (
                                <Check className="w-4 h-4" strokeWidth={3} />
                              ) : (
                                <X className="w-4 h-4" strokeWidth={3} />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-3 mt-auto">
                          <span className="type-label text-sm">
                            {correctCount}/{totalRounds} correct
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(isToday ? '/daily' : `/daily/${entry.date}`)
                            }}
                          >
                            View recap
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* --- Unplayed card --- */
                    <div className="bg-paper border-4 border-ink h-full flex flex-col">
                      {/* Placeholder area */}
                      <div className="h-28 bg-muted flex items-center justify-center border-b-4 border-ink">
                        <div className="text-center space-y-1">
                          <Calendar
                            className="w-8 h-8 text-text-placeholder mx-auto"
                            strokeWidth={2.5}
                          />
                          <p className="type-label text-xs text-text-muted">Not played</p>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-4 flex flex-col gap-4 flex-1">
                        <div>
                          <p className="type-display text-base leading-tight">{displayDate}</p>
                          <p className="type-label text-xs text-text-muted mt-1">{entry.date}</p>
                        </div>

                        {isToday && (
                          <span className="self-start type-label text-xs bg-side-a text-ink px-2 py-1">
                            Active today
                          </span>
                        )}

                        <div className="mt-auto">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                          >
                            <Play className="w-4 h-4" strokeWidth={3} />
                            {isToday ? 'Play now' : 'Start challenge'}
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

        <Button variant="ghost" onClick={() => navigate('/')}>
          <Home className="w-5 h-5" strokeWidth={3} />
          Home
        </Button>
      </div>
    </GameLayout>
  )
}

export default DailyChallengeArchive
