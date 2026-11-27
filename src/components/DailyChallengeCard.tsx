import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@/components/Brand'
import { fetchSchedule, getDailyScores, getTodayDate, type RoundDetail } from '@/lib/dailyChallenge'

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
  const [roundCount, setRoundCount] = useState(1)
  const [roundDetails, setRoundDetails] = useState<RoundDetail[]>([])
  const streak = computeStreak()

  useEffect(() => {
    async function check() {
      const today = getTodayDate()
      const scores = getDailyScores()

      if (scores[today]) {
        setRoundCount(scores[today].rounds)
        setRoundDetails(scores[today].roundDetails ?? [])
        setStatus('completed')
        return
      }

      const schedule = await fetchSchedule(today)
      const roundCount = schedule?.[today]?.images.length
      if (roundCount) setRoundCount(roundCount)
      setStatus(roundCount ? 'available' : 'no_challenge')
    }
    check()
  }, [])

  const squares = Array.from({ length: roundCount }, (_, i) => {
    if (status === 'completed') {
      const rd = roundDetails[i]
      if (!rd) return 'empty'
      return rd.correct ? 'correct' : 'wrong'
    }
    return 'empty'
  })

  const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()

  return (
    <article className="bg-side-b text-paper on-dark px-4 md:px-14 py-12 md:py-[72px] flex flex-col gap-[22px]">
      <span className="type-label text-base">Daily challenge · {dateLabel}</span>
      <h2 className="type-display text-[clamp(48px,5vw,80px)] leading-[0.88]">Which one’s real?</h2>
      <p className="font-medium text-[19px] leading-[1.45] text-on-blue-muted max-w-[34ch]">
        {status === 'loading' && 'Loading today’s challenge…'}
        {status === 'available' && (roundCount === 1
          ? 'One real photo, one AI image. Everyone plays the same pair.'
          : 'Everyone plays the same pairs. Finish before midnight.')}
        {status === 'completed' && 'You’ve finished today’s challenge. Come back tomorrow for a new pair.'}
        {status === 'no_challenge' && 'No challenge today. Check back tomorrow.'}
      </p>

      <div
        className="flex gap-2"
        role="img"
        aria-label={
          status !== 'completed' ? 'Not played yet' : roundDetails.length
            ? `${squares.filter((x) => x === 'correct').length} of ${roundCount} right`
            : 'Challenge completed'
        }
      >
        {squares.map((sq, i) => (
          <span
            key={i}
            className={`w-12 h-12 ${
              sq === 'correct'
                ? 'bg-paper'
                : sq === 'wrong'
                  ? 'border-4 border-paper'
                  : 'border-4 border-dashed border-slot-line-blue'
            }`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-6 mt-2.5">
        {status === 'completed' || status === 'no_challenge' ? (
          <Button variant="outline" onClick={() => navigate('/daily/archive')}>
            Past days
          </Button>
        ) : (
          <>
            <Button
              className="w-full sm:w-auto h-16 sm:h-[72px] px-5 sm:px-7 gap-2 sm:gap-3 text-base sm:text-2xl justify-between sm:justify-center"
              onClick={() => navigate('/daily')}
              disabled={status === 'loading'}
            >
              Play today’s challenge <ArrowRight />
            </Button>
            <button
              type="button"
              onClick={() => navigate('/daily/archive')}
              className="type-label text-base py-3 underline underline-offset-4"
            >
              Past days
            </button>
          </>
        )}
        {streak > 0 && <span className="type-label text-base">{streak}-day streak</span>}
      </div>
    </article>
  )
}

export default DailyChallengeCard
