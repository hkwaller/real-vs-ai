import { createClient } from '@supabase/supabase-js'
import { hasAdminSession } from '../server/admin-session.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  : null

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return value.slice(0, 4) !== '0000' && Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
}

// Players only see days that have started somewhere in the world (UTC+14 at most).
// Days scheduled ahead of time stay hidden until then.
function publicSchedule(schedule) {
  const latestToday = new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return Object.fromEntries(Object.entries(schedule).filter(([day]) => day <= latestToday))
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!supabase) return res.status(500).json({ error: 'Daily schedule is unavailable' })

  let args
  let adminRead = false
  if (req.method === 'GET') {
    const params = new URL(req.url, 'http://localhost').searchParams
    const today = params.get('today')
    if (today !== null && !isDate(today)) {
      return res.status(400).json({ error: 'Invalid date' })
    }
    if (params.has('admin')) {
      if (!(await hasAdminSession(req))) return res.status(403).json({ error: 'Admins only' })
      adminRead = true
    }
    args = today ? { p_action: 'fill', p_day: today } : { p_action: 'read' }
  } else {
    if (!(await hasAdminSession(req))) return res.status(403).json({ error: 'Admins only' })
    const { date, images } = req.body ?? {}
    if (!isDate(date) || (images !== null && (
      !Array.isArray(images) || !images.every((name) => typeof name === 'string' && name.length && !name.includes('/'))
    ))) {
      return res.status(400).json({ error: 'Invalid date or image filenames' })
    }
    args = { p_action: images === null ? 'delete' : 'save', p_day: date, p_images: images }
  }

  try {
    const result = await supabase.rpc('real_vs_ai_daily_schedule', args)
    if (result.error?.code === 'PT400') return res.status(400).json({ error: result.error.message })
    if (result.error?.code === 'PT409') return res.status(409).json({ error: result.error.message })
    if (result.error) throw result.error

    if (adminRead) {
      const pool = await supabase.rpc('real_vs_ai_daily_schedule', { p_action: 'pool' })
      if (pool.error) throw pool.error
      return res.status(200).json({ schedule: result.data, remaining: pool.data.remaining })
    }
    if (req.method === 'POST') return res.status(200).json(result.data)
    return res.status(200).json(publicSchedule(result.data))
  } catch (error) {
    console.error('daily-schedule:', error)
    return res.status(500).json({ error: 'Daily schedule is unavailable' })
  }
}
