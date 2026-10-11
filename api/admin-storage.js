import { createClerkClient, verifyToken } from '@clerk/backend'
import { createClient } from '@supabase/supabase-js'

// Admin-only writes to the `real-vs-ai` bucket. The bucket allows public reads
// but no anon/authenticated writes, so every insert/update/delete goes through
// here with the service-role key. Admins are Clerk users with
// publicMetadata.role === 'admin'.
//
// Uploads use signed upload URLs: this route mints a one-off token and the
// browser uploads straight to Storage, which avoids Vercel's request body limit.

const BUCKET = 'real-vs-ai'
const ALLOWED_PATH = /^(?:(?:real|ai)\/[A-Za-z0-9._ -]+|challenges\/schedule\.json)$/

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const missingEnv = Object.entries({
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
  .filter(([, v]) => !v)
  .map(([k]) => k)

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const supabase = missingEnv.length
  ? null
  : createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

async function requireAdmin(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) {
    console.warn(`admin-storage: no bearer token (user-agent: ${req.headers['user-agent']})`)
    return false
  }
  try {
    const { sub } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })
    const user = await clerk.users.getUser(sub)
    if (user.publicMetadata?.role !== 'admin') {
      console.warn(`admin-storage: ${sub} is not an admin`)
      return false
    }
    return true
  } catch (err) {
    console.warn('admin-storage: token verification failed:', err?.reason ?? err?.message ?? err)
    return false
  }
}

const isAllowedPath = (path) =>
  typeof path === 'string' && ALLOWED_PATH.test(path) && !path.includes('..')

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (missingEnv.length) {
    console.error(`admin-storage: missing env ${missingEnv.join(', ')}`)
    return res.status(500).json({ error: `Server misconfigured: missing ${missingEnv.join(', ')}` })
  }

  if (!(await requireAdmin(req))) {
    return res.status(403).json({ error: 'Admins only' })
  }

  const { action, path, paths } = req.body ?? {}

  if (action === 'sign-upload') {
    if (!isAllowedPath(path)) return res.status(400).json({ error: 'Invalid path' })
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ path: data.path, token: data.token })
  }

  if (action === 'remove') {
    if (!Array.isArray(paths) || paths.length === 0 || !paths.every(isAllowedPath)) {
      return res.status(400).json({ error: 'Invalid paths' })
    }
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
