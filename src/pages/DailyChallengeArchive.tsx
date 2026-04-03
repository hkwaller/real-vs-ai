import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import { Loader2, Calendar, Trophy, Home, ArrowRight } from 'lucide-react'
import {
  fetchSchedule,
  getDailyScores,
  getTodayDate,
  type DailySchedule,
  type DailyScores,
} from '@/lib/dailyChallenge'

type ChallengeEntry = {
  date: string
  available: boolean
  score?: number
  maxScore?: number
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
        <Card className="text-center p-10 border-0">
          <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
          <h1 className="text-2xl font-bold">Loading archive...</h1>
        </Card>
      </GameLayout>
    )
  }

  const today = getTodayDate()

  return (
    <GameLayout>
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
        <div className="text-center w-full">
          <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
            <Calendar className="w-5 h-5" />
            <span className="font-semibold">Daily Challenge Archive</span>
          </div>
          <p className="text-muted-foreground text-sm">Browse and replay past challenges</p>
        </div>

        {entries.length === 0 ? (
          <Card className="w-full text-center p-8">
            <p className="text-muted-foreground">No challenges available yet.</p>
          </Card>
        ) : (
          <motion.div
            className="w-full flex flex-col gap-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04 } },
            }}
          >
            {entries.map((entry) => {
              const isToday = entry.date === today
              const completed = entry.score !== undefined
              const pct = completed ? Math.round((entry.score! / entry.maxScore!) * 100) : null

              return (
                <motion.div
                  key={entry.date}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                >
                  <Card
                    className={`w-full cursor-pointer hover:border-amber-500/50 transition-colors ${isToday ? 'border-amber-500/30' : ''}`}
                    onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                  >
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            completed
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/10 text-muted-foreground'
                          }`}
                        >
                          {completed ? <Trophy className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {isToday ? "Today's Challenge" : new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {completed && pct !== null ? (
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="w-20 bg-white/10 rounded-full h-1">
                                <div
                                  className="bg-gradient-to-r from-amber-400 to-orange-400 h-1 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-amber-400 font-medium">
                                {entry.score}/{entry.maxScore}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not completed</p>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
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
