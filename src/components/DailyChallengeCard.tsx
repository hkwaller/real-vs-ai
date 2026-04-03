import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
    <Card className="group hover:border-amber-500/50 transition-colors cursor-pointer text-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Calendar className="w-6 h-6 text-amber-400 group-hover:animate-pulse" />
          Daily Challenge
        </CardTitle>
        <CardDescription>
          {status === 'loading' && 'Loading today\'s challenge...'}
          {status === 'available' && 'A new challenge awaits you today'}
          {status === 'completed' && 'You\'ve already completed today\'s challenge'}
          {status === 'no_challenge' && 'No challenge scheduled for today'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          </div>
        )}

        {status === 'available' && (
          <Button
            variant="neon"
            size="xl"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border-amber-500/50"
            onClick={() => navigate('/daily')}
          >
            Play Today
          </Button>
        )}

        {status === 'completed' && score !== null && maxScore !== null && (
          <>
            <div className="flex items-center justify-center gap-2 py-1">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-xl font-bold text-amber-400">
                {score}
                <span className="text-sm text-muted-foreground font-normal">/{maxScore}</span>
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-amber-400 to-orange-400 h-1.5 rounded-full"
                style={{ width: `${Math.round((score / maxScore) * 100)}%` }}
              />
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/daily/archive">Past Challenges</Link>
            </Button>
          </>
        )}

        {status === 'no_challenge' && (
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to="/daily/archive">Past Challenges</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default DailyChallengeCard
