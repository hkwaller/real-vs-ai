import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
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
      <div className="flex flex-col items-center gap-6 w-full max-w-md">
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
                  <div
                    className={`bg-[#111840] border cursor-pointer hover:border-[#FF6B1A]/50 transition-colors px-4 py-3 flex items-center justify-between ${
                      isToday ? 'border-[#FFB830]/50' : 'border-[#2A3468]'
                    }`}
                    onClick={() => navigate(isToday ? '/daily' : `/daily/${entry.date}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 flex items-center justify-center text-sm ${
                          completed
                            ? 'bg-[#FFB830]/20 text-[#FFB830]'
                            : 'bg-[#1A2355] text-[#8B97C8]'
                        }`}
                      >
                        {completed ? <Trophy className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-orbitron text-sm font-bold text-[#F5F0E8] uppercase tracking-wide">
                          {isToday
                            ? "Today's Challenge"
                            : new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                        </p>
                        {completed && pct !== null ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-20 bg-[#0B0F2E] h-1 border border-[#2A3468]">
                              <div
                                className="bg-[#FFB830] h-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-space-mono text-xs text-[#FFB830] font-bold">
                              {entry.score}/{entry.maxScore}
                            </span>
                          </div>
                        ) : (
                          <p className="font-space-mono text-xs text-[#8B97C8]">Not completed</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#8B97C8]" />
                  </div>
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
