import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Calendar, Trophy, Loader2 } from 'lucide-react'
import { fetchSchedule, getDailyScores, getTodayDate } from '@/lib/dailyChallenge'

type CardStatus = 'loading' | 'available' | 'completed' | 'no_challenge'

const DailyChallengeCard: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<CardStatus>('loading')
  const [score, setScore] = useState<number | null>(null)
  const [maxScore, setMaxScore] = useState<number | null>(null)

  useEffect(() => {
    async function check() {
      const today = getTodayDate()
      const scores = getDailyScores()

      if (scores[today]) {
        setScore(scores[today].score)
        setMaxScore(scores[today].maxScore)
        setStatus('completed')
        return
      }

      const schedule = await fetchSchedule()
      if (schedule?.[today]) {
        setStatus('available')
      } else {
        setStatus('no_challenge')
      }
    }
    check()
  }, [])

  return (
    <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6 space-y-5 hover:border-[#FFB830]/50 transition-colors">
      <div>
        <p className="mission-label mb-2">Daily Challenge</p>
        <h2 className="font-orbitron text-2xl font-bold text-[#F5F0E8] uppercase tracking-wide flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#FFB830]" />
          Today's Mission
        </h2>
        <p className="text-[#8B97C8] text-sm mt-2">
          {status === 'loading' && "Loading today's challenge..."}
          {status === 'available' && 'A new challenge awaits. Prove your instincts.'}
          {status === 'completed' && "You've completed today's challenge."}
          {status === 'no_challenge' && 'No challenge scheduled for today.'}
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFB830]" />
        </div>
      )}

      {status === 'available' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FFB830] animate-pulse" />
            <span className="font-space-mono text-xs text-[#FFB830]">CHALLENGE ACTIVE</span>
          </div>
          <Button size="lg" className="w-full" onClick={() => navigate('/daily')}>
            Play Now
          </Button>
        </div>
      )}

      {status === 'completed' && score !== null && maxScore !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FFB830]" />
              <span className="mission-label">Score</span>
            </div>
            <span className="font-space-mono text-lg font-bold text-[#FFB830]">
              {score}
              <span className="text-[#8B97C8] text-sm font-normal">/{maxScore}</span>
            </span>
          </div>
          <div className="w-full bg-[#0B0F2E] h-1.5 border border-[#2A3468]">
            <div
              className="bg-[#FFB830] h-full transition-all"
              style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
            />
          </div>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to="/daily/archive">Past Challenges</Link>
          </Button>
        </div>
      )}

      {status === 'no_challenge' && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to="/daily/archive">Past Challenges</Link>
        </Button>
      )}
    </div>
  )
}

export default DailyChallengeCard
