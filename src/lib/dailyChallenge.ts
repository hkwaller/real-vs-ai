import { supabase } from './supabase'
import type { GetToken } from './adminStorage'

export type DailyScheduleEntry = {
  images: string[]
}

export type DailySchedule = {
  [date: string]: DailyScheduleEntry
}

export type RoundDetail = {
  roundId: string
  realImageUrl: string
  aiImageUrl: string
  isRealLeft: boolean
  correctChoice: 'A' | 'B'
  playerChoice: 'A' | 'B' | null
  correct: boolean
  points: number
}

export type DailyScore = {
  score: number
  maxScore: number
  rounds: number
  completedAt: string
  roundDetails?: RoundDetail[]
}

export type DailyScores = {
  [date: string]: DailyScore
}

export type DailyRound = {
  id: string
  realImageUrl: string
  aiImageUrl: string
  filename: string
}

const BUCKET = 'real-vs-ai'
const SCORES_KEY = 'rvai_daily_scores'
const TIME_LIMIT = 15

export { TIME_LIMIT }

export function getTodayDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function fetchSchedule(today?: string): Promise<DailySchedule | null> {
  try {
    const url = today ? `/api/daily-schedule?today=${encodeURIComponent(today)}` : '/api/daily-schedule'
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return json as DailySchedule
  } catch {
    return null
  }
}

export async function saveChallenge(date: string, images: string[] | null, getToken: GetToken): Promise<DailySchedule> {
  const token = await getToken()
  if (!token) throw new Error('Sign in again to edit the schedule.')
  const res = await fetch('/api/daily-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date, images }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error ?? 'Could not update the schedule.')
  return result as DailySchedule
}

export function getDailyScores(): DailyScores {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) ?? '{}') as DailyScores
  } catch {
    return {}
  }
}

export function saveDailyScore(date: string, result: DailyScore): void {
  const scores = getDailyScores()
  scores[date] = result
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores))
}

export function getImageUrls(filename: string): { realUrl: string; aiUrl: string } {
  const realUrl = supabase.storage.from(BUCKET).getPublicUrl(`real/${filename}`).data.publicUrl
  const aiUrl = supabase.storage.from(BUCKET).getPublicUrl(`ai/${filename}`).data.publicUrl
  return { realUrl, aiUrl }
}

export function buildRounds(date: string, images: string[]): DailyRound[] {
  return images.map((filename, index) => {
    const id = `${date}-${index}`
    const { realUrl, aiUrl } = getImageUrls(filename)
    return { id, realImageUrl: realUrl, aiImageUrl: aiUrl, filename }
  })
}

const GRACE_PERIOD = 3 // seconds at start that always award full points
const SCORING_WINDOW = TIME_LIMIT - GRACE_PERIOD

export function calcPoints(timeRemaining: number): number {
  if (timeRemaining >= SCORING_WINDOW) return 100
  return Math.round(100 * (timeRemaining / SCORING_WINDOW))
}

export function msUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
