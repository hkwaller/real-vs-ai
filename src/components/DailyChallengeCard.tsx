import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  fetchSchedule,
  getDailyScores,
  getTodayDate,
  type RoundDetail,
} from '@/lib/dailyChallenge'

type CardStatus = 'loading' | 'available' | 'completed' | 'no_challenge'

// Consecutive days (ending today or yesterday) that have a saved score.
function computeStreak(): number {
  const scores = getDailyScores()
  let streak = 0
  const d = new Date()
  // Allow the streak to still count if today isn't done yet.
  const todayKey = getTodayDate()
  if (!scores[todayKey]) d.setDate(d.getDate() - 1)
  for (;;) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    if (!scores[`${yyyy}-${mm}-${dd}`]) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

const DailyChallengeCard: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<CardStatus>('loading')
  const [roundDetails, setRoundDetails] = useState<RoundDetail[]>([])
  const streak = computeStreak()

  useEffect(() => {
    async function check() {
      const today = getTodayDate()
      const scores = getDailyScores()

      if (scores[today]) {
        setRoundDetails(scores[today].roundDetails ?? [])
        setStatus('completed')
        return
      }

      const schedule = await fetchSchedule()
      setStatus(schedule?.[today] ? 'available' : 'no_challenge')
    }
    check()
  }, [])

  const squares = Array.from({ length: 5 }).map((_, i) => {
    if (status === 'completed') {
      const rd = roundDetails[i]
      if (!rd) return 'empty'
      return rd.correct ? 'correct' : 'wrong'
    }
    return 'empty'
  })

  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-[#1F2450] p-6">
      <p className="font-body font-bold text-xs tracking-[0.15em] uppercase text-[#57E6D2] mb-2">
        Daily challenge
      </p>
      <h2 className="font-display font-bold text-[#FFF8F0] text-2xl">Today's five</h2>
      <p className="text-[#9AA3D0] text-sm mt-2">
        {status === 'loading' && 'Loading today’s challenge…'}
        {status === 'available' && 'Five new rounds every day — finish before midnight.'}
        {status === 'completed' && "Nice — you've finished today's five."}
        {status === 'no_challenge' && 'No challenge today. Check back tomorrow.'}
      </p>

      {/* Progress squares */}
      <div className="flex items-center gap-2 mt-5">
        {squares.map((s, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-[4px] ${
              s === 'correct'
                ? 'bg-[#57E6D2]'
                : s === 'wrong'
                  ? 'bg-[#FF6A6A]'
                  : 'bg-white/10'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mt-6">
        {status === 'completed' || status === 'no_challenge' ? (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate('/daily/archive')}>
            Past challenges
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/daily')} disabled={status === 'loading'}>
            Keep playing
          </Button>
        )}
        {streak > 0 && (
          <span className="font-body font-semibold text-sm text-[#FFC94D]">🔥 {streak}-day streak</span>
        )}
      </div>
    </div>
  )
}

export default DailyChallengeCard
