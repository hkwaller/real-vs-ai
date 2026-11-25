import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { hasAdminSession } from '../server/admin-session.js'

const DRAFTS = 'real-vs-ai-drafts'
const PUBLIC = 'real-vs-ai'
const TABLE = 'real_vs_ai_image_drafts'
const GENERATION_TIMEOUT = 10 * 60_000
const PUBLISH_TIMEOUT = 65_000
const CUTOFF = '2021-01-01'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

async function unsplashGet(path, params) {
  const url = new URL(path, 'https://api.unsplash.com')
  if (params) url.search = new URLSearchParams(params).toString()
  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      'Accept-Version': 'v1',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new RequestError(502, 'Unsplash could not complete the request.')
  return response.json()
}

function eligiblePhoto(photo) {
  return PHOTO_ID.test(photo?.id ?? '') && typeof photo.created_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(photo.created_at) && photo.created_at.slice(0, 10) < CUTOFF
    && photo.premium !== true && photo.plus !== true && photo.asset_type === 'photo'
    && Boolean(photo.links?.html && photo.user?.links?.html && photo.urls?.regular)
    && photo.urls.regular.startsWith('https://images.unsplash.com/')
}

function attribution(url) {
  const link = new URL(url)
  link.searchParams.set('utm_source', 'real_vs_ai')
  link.searchParams.set('utm_medium', 'referral')
  return link.href
}

function originalPath(id) {
  return `${id}/real.jpg`
}

function outputPath(id, attempt) {
  return `${id}/${attempt}.jpg`
}

function failurePath(id, attempt) {
  return `${id}/${attempt}-error.json`
}

async function transition(db, draft, changes) {
  return unwrap(await db.from(TABLE).update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', draft.id).eq('status', draft.status).eq('updated_at', draft.updated_at)
    .select().maybeSingle())
}

async function refreshGeneration(db, draft) {
  if (draft.status !== 'generating') return draft
  const files = unwrap(await db.storage.from(DRAFTS).list(draft.id, {
    limit: 2,
    search: draft.attempt_id,
  }))
  const names = new Set(files.map(({ name }) => name))
  let status
  if (names.has(`${draft.attempt_id}.jpg`)) status = 'review'
  else if (names.has(`${draft.attempt_id}-error.json`) ||
    Date.now() - Date.parse(draft.updated_at) >= GENERATION_TIMEOUT) status = 'failed'
  if (!status) return draft
  return await transition(db, draft, { status }) ?? draft
}

async function listDrafts(db) {
  const drafts = unwrap(await db.from(TABLE).select().not('status', 'in', '(published,skipped)')
    .order('created_at', { ascending: false }).limit(36))
  const refreshed = await Promise.all(drafts.map(draft => refreshGeneration(db, draft)))
  const paths = refreshed.flatMap(draft => {
    const original = originalPath(draft.id)
    return ['review', 'publishing'].includes(draft.status)
      ? [original, outputPath(draft.id, draft.attempt_id)]
      : [original]
  })
  const previews = paths.length
    ? unwrap(await db.storage.from(DRAFTS).createSignedUrls(paths, 900))
    : []
  const urls = new Map(previews.map(file => [file.path, file.signedUrl]))
  return refreshed.map(draft => ({
    ...draft,
    canResumePublish: draft.status === 'publishing' && Date.now() - Date.parse(draft.updated_at) >= PUBLISH_TIMEOUT,
    realUrl: urls.get(originalPath(draft.id)) ?? null,
    aiUrl: urls.get(outputPath(draft.id, draft.attempt_id)) ?? null,
  }))
}

async function searchCatalog(db, category, page) {
  if (!process.env.UNSPLASH_ACCESS_KEY) throw new RequestError(409, 'Unsplash search is not configured.')
  const result = await unsplashGet('/search/photos', {
    query: category, page, per_page: 20, content_filter: 'high', order_by: 'relevant',
  })
  const eligible = (result.results ?? []).filter(eligiblePhoto)
  const used = eligible.length
    ? unwrap(await db.from(TABLE).select('source_id').in('source_id', eligible.map(photo => photo.id)))
    : []
  const usedIds = new Set(used.map(({ source_id }) => source_id))
  return {
    hasMore: page < Math.min(result.total_pages, 200),
    photos: eligible.filter(photo => !usedIds.has(photo.id)).map(photo => ({
      id: photo.id,
      imageUrl: photo.urls.small ?? photo.urls.regular,
      sourceUrl: attribution(photo.links.html),
      photographer: photo.user.name,
      photographerUrl: attribution(photo.user.links.html),
      description: photo.alt_description,
      date: photo.created_at.slice(0, 10),
    })),
  }
}

async function importPhoto(db, draft, photo) {
  if (process.env.UNSPLASH_PAIR_IMPORT_ENABLED !== 'true' ||
    !process.env.UNSPLASH_ACCESS_KEY) {
    throw new RequestError(409, 'Unsplash pair generation is not enabled.')
  }
  photo ??= await unsplashGet(`/photos/${draft.source_id}`)
  if (!eligiblePhoto(photo)) throw new RequestError(422, 'Choose an eligible free photo uploaded before 2021.')
  const trackingUrl = new URL(photo.links.download_location)
  if (trackingUrl.origin !== 'https://api.unsplash.com') throw new Error('Invalid download endpoint')
  await unsplashGet(trackingUrl.pathname, trackingUrl.searchParams)

  const imageUrl = new URL(photo.urls.regular)
  if (imageUrl.origin !== 'https://images.unsplash.com') throw new Error('Invalid image origin')
  imageUrl.searchParams.delete('auto')
  for (const [key, value] of Object.entries({ w: '1024', h: '1024', fit: 'crop', crop: 'entropy', fm: 'jpg', q: '85' })) {
    imageUrl.searchParams.set(key, value)
  }
  const response = await fetch(imageUrl, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
  if (!response.ok || !/^image\/jpeg\b/i.test(response.headers.get('content-type') ?? '')) {
    throw new RequestError(502, 'Could not download the selected photo.')
  }
  const image = await response.blob()
  unwrap(await db.storage.from(DRAFTS).upload(originalPath(draft.id), image, {
    contentType: 'image/jpeg', upsert: true,
  }))
}

async function generate(db, draft, photo) {
  if (!['awaiting_source', 'failed', 'review'].includes(draft.status)) {
    throw new RequestError(409, 'This draft is already being processed.')
  }

  const endpoint = process.env.IMAGE_PAIR_N8N_WEBHOOK_URL
  const secret = process.env.IMAGE_PAIR_N8N_WEBHOOK_SECRET
  if (!endpoint || !secret) throw new RequestError(503, 'The image worker is not configured.')
  if (draft.status === 'awaiting_source' && draft.source === 'unsplash') await importPhoto(db, draft, photo)

  const storage = db.storage.from(DRAFTS)
  const original = await storage.createSignedUrl(originalPath(draft.id), 1800)
  if (original.error) throw new RequestError(409, 'The original photo is missing. Upload it first.')

  const attempt = randomUUID()
  const [output, failure] = await Promise.all([
    storage.createSignedUploadUrl(outputPath(draft.id, attempt)),
    storage.createSignedUploadUrl(failurePath(draft.id, attempt)),
  ])
  const outputUrl = unwrap(output).signedUrl
  const failureUrl = unwrap(failure).signedUrl
  const job = await transition(db, draft, { status: 'generating', attempt_id: attempt })
  if (!job) throw new RequestError(409, 'This draft was updated. Refresh the queue.')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'X-Image-Worker-Key': secret },
      body: JSON.stringify({ imageUrl: original.data.signedUrl, outputUrl, failureUrl }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}`)
    const acknowledgement = await response.json()
    if (acknowledgement.accepted !== true) throw new Error('Unexpected worker response')
  } catch (error) {
    console.error('image worker dispatch:', error.name, error.message)
    // Leave ambiguous dispatches pending so an accepted job can still finish.
    throw new RequestError(502, 'The worker did not confirm receipt. The queue will show the result or time out.')
  }
}

async function publish(db, draft) {
  const resume = draft.status === 'publishing' && Date.now() - Date.parse(draft.updated_at) >= PUBLISH_TIMEOUT
  if (draft.status !== 'review' && !resume) throw new RequestError(409, 'This pair is not ready to publish.')
  const lock = await transition(db, draft, { status: 'publishing' })
  if (!lock) throw new RequestError(409, 'This draft was updated. Refresh the queue.')

  const staging = db.storage.from(DRAFTS)
  const live = db.storage.from(PUBLIC)
  const filename = `pair_${draft.id}.jpg`
  const [real, ai] = (await Promise.all([
    staging.download(originalPath(draft.id)),
    staging.download(outputPath(draft.id, draft.attempt_id)),
  ])).map(unwrap)
  const options = { contentType: 'image/jpeg', cacheControl: '3600', upsert: true }
  // The game discovers pairs by listing real/. Write the AI image first.
  unwrap(await live.upload(`ai/${filename}`, ai, options))
  unwrap(await live.upload(`real/${filename}`, real, options))
  if (!await transition(db, lock, { status: 'published' })) throw new Error('Publish lock changed')
  return filename
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!await hasAdminSession(req)) return res.status(403).json({ error: 'Admins only' })

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'Supabase administration is not configured.' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { action, id, photoId, category, page = 1 } = req.body ?? {}
  const searchConfigured = Boolean(process.env.UNSPLASH_ACCESS_KEY)
  const importEnabled = searchConfigured && process.env.UNSPLASH_PAIR_IMPORT_ENABLED === 'true'
  try {
    if (action === 'list') return res.json({ drafts: await listDrafts(db), searchConfigured, importEnabled })
    if (action === 'search') {
      const query = typeof category === 'string' ? category.trim() : ''
      if (!query || query.length > 80 || !Number.isInteger(page) || page < 1 || page > 200) {
        throw new RequestError(400, 'Enter a valid category.')
      }
      return res.json(await searchCatalog(db, query, page))
    }
    if (action === 'create-upload') {
      const draft = unwrap(await db.from(TABLE).insert({ source: 'upload' }).select().single())
      const { path, token } = unwrap(await db.storage.from(DRAFTS).createSignedUploadUrl(originalPath(draft.id)))
      return res.json({ id: draft.id, path, token })
    }
    if (action === 'create-unsplash' || action === 'generate-category') {
      if (!importEnabled) throw new RequestError(409, 'Unsplash pair generation is not enabled.')
      const query = typeof category === 'string' ? category.trim().slice(0, 80) : ''
      let selected = photoId
      if (action === 'generate-category') {
        if (!query) throw new RequestError(400, 'Enter a category.')
        for (let searchPage = 1; searchPage <= 4; searchPage++) {
          const result = await searchCatalog(db, query, searchPage)
          selected = result.photos[0]?.id
          if (selected || !result.hasMore) break
        }
        if (!selected) throw new RequestError(404, 'No unused older photos found. Try a more specific category.')
      }
      if (typeof selected !== 'string' || !PHOTO_ID.test(selected)) throw new RequestError(400, 'Invalid photo ID.')
      const photo = await unsplashGet(`/photos/${selected}`)
      if (!eligiblePhoto(photo)) throw new RequestError(422, 'Choose an eligible free photo uploaded before 2021.')
      const { data: draft, error } = await db.from(TABLE).insert({
        source: 'unsplash', source_id: photo.id, source_url: attribution(photo.links.html),
        photographer: photo.user.name, photographer_url: attribution(photo.user.links.html),
        source_date: photo.created_at.slice(0, 10),
        category: query || null,
      }).select().single()
      if (error?.code === '23505') throw new RequestError(409, 'This photo is already in the pipeline.')
      if (error) throw error
      await generate(db, draft, photo)
      return res.status(202).json({ id: draft.id, photoId: photo.id })
    }
    if (typeof id !== 'string' || !UUID.test(id)) throw new RequestError(400, 'Invalid draft ID.')
    const draft = unwrap(await db.from(TABLE).select().eq('id', id).maybeSingle())
    if (!draft) throw new RequestError(404, 'Draft not found.')
    const current = await refreshGeneration(db, draft)
    if (action === 'sign-source') {
      if (current.source !== 'upload' || current.status !== 'awaiting_source') {
        throw new RequestError(409, 'This draft cannot accept a source upload.')
      }
      const { path, token } = unwrap(await db.storage.from(DRAFTS).createSignedUploadUrl(originalPath(id)))
      return res.json({ id, path, token })
    }
    if (action === 'generate') {
      await generate(db, current)
      return res.status(202).json({ id })
    }
    if (action === 'publish') return res.json({ filename: await publish(db, current) })
    if (action === 'skip') {
      if (!['awaiting_source', 'failed', 'review'].includes(current.status) ||
        !await transition(db, current, { status: 'skipped' })) {
        throw new RequestError(409, 'This draft cannot be skipped right now.')
      }
      return res.json({ id })
    }
    return res.status(400).json({ error: 'Unknown action' })
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message })
    console.error('admin-image-pairs:', action, error.message)
    return res.status(500).json({ error: 'The draft operation failed. Check server logs and refresh the queue.' })
  }
}
