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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!supabase) return res.status(500).json({ error: 'Daily schedule is unavailable' })

  let args
  if (req.method === 'GET') {
    const today = new URL(req.url, 'http://localhost').searchParams.get('today')
    if (today !== null && !isDate(today)) {
      return res.status(400).json({ error: 'Invalid date' })
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
    let result = await supabase.rpc('real_vs_ai_daily_schedule', args)
    if (!result.error && result.data === null) {
      // The database saw a legacy schedule. Import it before drawing any pairs.
      const { data, error } = await supabase.storage.from('real-vs-ai').download('challenges/schedule.json')
      if (error) throw error
      const legacy = JSON.parse(await data.text())
      result = await supabase.rpc('real_vs_ai_daily_schedule', { ...args, p_legacy: legacy })
    }
    if (result.error?.code === 'PT400') return res.status(400).json({ error: result.error.message })
    if (result.error?.code === 'PT409') return res.status(409).json({ error: result.error.message })
    if (result.error || result.data === null) throw result.error ?? new Error('Could not import schedule')
    return res.status(200).json(result.data)
  } catch (error) {
    console.error('daily-schedule:', error)
    return res.status(500).json({ error: 'Daily schedule is unavailable' })
  }
}
