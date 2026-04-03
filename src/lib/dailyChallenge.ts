import { supabase } from './supabase'

export type DailyScheduleEntry = {
  images: string[]
}

export type DailySchedule = {
  [date: string]: DailyScheduleEntry
}

export type DailyScore = {
  score: number
  maxScore: number
  rounds: number
  completedAt: string
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

const SCHEDULE_PATH = 'challenges/schedule.json'
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

export async function fetchSchedule(): Promise<DailySchedule | null> {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(SCHEDULE_PATH)
    const res = await fetch(`${data.publicUrl}?t=${Date.now()}`)
    if (!res.ok) return null
    const json = await res.json()
    return json as DailySchedule
  } catch {
    return null
  }
}

export async function saveSchedule(schedule: DailySchedule): Promise<boolean> {
  try {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' })
    const file = new File([blob], 'schedule.json', { type: 'application/json' })
    const { error } = await supabase.storage.from(BUCKET).upload(SCHEDULE_PATH, file, {
      upsert: true,
      contentType: 'application/json',
    })
    return !error
  } catch {
    return false
  }
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

export function calcPoints(timeRemaining: number): number {
  return Math.max(10, Math.round(100 * (timeRemaining / TIME_LIMIT)))
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
