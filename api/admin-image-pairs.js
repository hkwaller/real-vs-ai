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
const EDITABLE = ['awaiting_source', 'failed', 'review']
const LIBRARY_PREFIX = 'library:'
const LIBRARY_JPEG = /^[A-Za-z0-9._ -]+\.jpg$/i
const LIBRARY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function replacementFilename(draft) {
  if (draft.source !== 'upload' || !draft.source_id?.startsWith(LIBRARY_PREFIX)) return null
  return draft.source_id.slice(LIBRARY_PREFIX.length).split(':', 1)[0]
}

function previousAiPath(id) {
  return `${id}/previous-ai.jpg`
}

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

function briefPath(id, attempt) {
  return `${id}/brief-${attempt}.json`
}

function failurePath(id, attempt) {
  return `${id}/${attempt}-error.json`
}

async function transition(db, draft, changes) {
  const update = db.from(TABLE).update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', draft.id).eq('status', draft.status).eq('updated_at', draft.updated_at)
  const guarded = draft.attempt_id
    ? update.eq('attempt_id', draft.attempt_id)
    : update.is('attempt_id', null)
  return unwrap(await guarded.select().maybeSingle())
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

export async function libraryReplacementCandidates(db, before) {
  const library = db.storage.from(PUBLIC)
  async function allFiles(folder) {
    const files = []
    for (let offset = 0; ; offset += 100) {
      const page = unwrap(await library.list(folder, {
        limit: 100, offset, sortBy: { column: 'name', order: 'asc' },
      }))
      files.push(...page.filter(file => file.metadata && LIBRARY_JPEG.test(file.name)
        && !file.name.startsWith('.') && !file.name.includes('..')))
      if (page.length < 100) return files
    }
  }
  const [originals, generated] = await Promise.all([allFiles('real'), allFiles('ai')])
  const originalNames = new Set(originals.map(file => file.name))
  return generated.flatMap(file => {
    const revision = file.updated_at ?? file.created_at
    if (!originalNames.has(file.name) || !revision || revision.slice(0, 10) >= before) return []
    return [{ filename: file.name, revision, sourceId: `${LIBRARY_PREFIX}${file.name}:${revision}` }]
  }).sort((a, b) => a.revision.localeCompare(b.revision) || a.filename.localeCompare(b.filename))
}

export async function reserveLibraryReplacement(db, candidate) {
  const { filename, sourceId } = candidate
  const existing = await db.from(TABLE).select().eq('source_id', sourceId).maybeSingle()
  let draft = unwrap(existing)
  if (draft && !['awaiting_source', 'failed'].includes(draft.status)) return null
  const library = db.storage.from(PUBLIC)
  const staging = db.storage.from(DRAFTS)
  if (!draft) {
    const result = await db.from(TABLE).insert({ source: 'upload', source_id: sourceId }).select().single()
    if (result.error?.code === '23505') return null
    draft = unwrap(result)
  }

  for (const [livePath, privatePath] of [
    [`real/${filename}`, originalPath(draft.id)],
    [`ai/${filename}`, previousAiPath(draft.id)],
  ]) {
    const { error: missing } = await staging.createSignedUrl(privatePath, 60)
    if (missing) {
      const blob = unwrap(await library.download(livePath))
      if (!LIBRARY_IMAGE_TYPES.includes(blob.type)) {
        throw new Error(`Unsupported library file type for ${livePath}.`)
      }
      const { error } = await staging.upload(privatePath, blob, { contentType: blob.type })
      if (error && (await staging.createSignedUrl(privatePath, 60)).error) throw error
    }
  }
  return draft
}

export async function listDrafts(db) {
  const drafts = []
  for (let start = 0; ; start += 100) {
    const page = unwrap(await db.from(TABLE).select().not('status', 'in', '(published,skipped)')
      .order('created_at', { ascending: false }).order('id').range(start, start + 99))
    drafts.push(...page)
    if (page.length < 100) break
  }
  const refreshed = await Promise.all(drafts.map(draft => refreshGeneration(db, draft)))
  const paths = refreshed.flatMap(draft => {
    const files = [originalPath(draft.id)]
    if (replacementFilename(draft)) files.push(previousAiPath(draft.id))
    if (['review', 'publishing'].includes(draft.status)) {
      files.push(outputPath(draft.id, draft.attempt_id), briefPath(draft.id, draft.attempt_id))
    }
    return files
  })
  const previewBatches = []
  for (let index = 0; index < paths.length; index += 100) {
    previewBatches.push(paths.slice(index, index + 100))
  }
  const staging = db.storage.from(DRAFTS)
  const previews = (await Promise.all(previewBatches.map(async batch =>
    unwrap(await staging.createSignedUrls(batch, 900)),
  ))).flat()
  const urls = new Map(previews.map(file => [file.path, file.signedUrl]))
  return refreshed.map(draft => ({
    ...draft,
    canResumePublish: draft.status === 'publishing' && Date.now() - Date.parse(draft.updated_at) >= PUBLISH_TIMEOUT,
    realUrl: urls.get(originalPath(draft.id)) ?? null,
    aiUrl: urls.get(outputPath(draft.id, draft.attempt_id)) ?? null,
    previousAiUrl: urls.get(previousAiPath(draft.id)) ?? null,
    replacementFilename: replacementFilename(draft),
    briefUrl: urls.get(briefPath(draft.id, draft.attempt_id)) ?? null,
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

export function unsplashImportEnabled() {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY) && process.env.UNSPLASH_PAIR_IMPORT_ENABLED === 'true'
}

export async function reserveCatalogDraft(db, { photoId, category, findByCategory }) {
  if (!unsplashImportEnabled()) throw new RequestError(409, 'Unsplash pair generation is not enabled.')
  const query = typeof category === 'string' ? category.trim().slice(0, 80) : ''
  let selected = photoId
  if (findByCategory) {
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
  return { draft, photo }
}

export async function importPhoto(db, draft, photo) {
  if (!unsplashImportEnabled()) {
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

async function getOriginal(storage, id, expiresIn) {
  const original = await storage.createSignedUrl(originalPath(id), expiresIn)
  if (original.error) throw new RequestError(409, 'The original photo is missing. Upload it first.')
  return original.data.signedUrl
}

export async function counterpartUpload(db, draft, { action, attempt, version }) {
  if (!EDITABLE.includes(draft.status)) {
    throw new RequestError(409, 'This draft cannot accept a counterpart right now.')
  }
  const storage = db.storage.from(DRAFTS)
  const currentVersion = draftVersion(draft)
  if (action === 'sign-counterpart') {
    await getOriginal(storage, draft.id, 60)
    const attempt = randomUUID()
    const { path, token } = unwrap(await storage.createSignedUploadUrl(outputPath(draft.id, attempt)))
    return { attempt, version: currentVersion, path, token }
  }

  if (version !== currentVersion) {
    throw new RequestError(409, 'This draft changed during upload. Refresh and try again.')
  }
  if (typeof attempt !== 'string' || !UUID.test(attempt)) {
    throw new RequestError(400, 'Invalid counterpart upload.')
  }
  const uploaded = await storage.createSignedUrl(outputPath(draft.id, attempt), 60)
  if (uploaded.error) throw new RequestError(409, 'The counterpart has not been uploaded.')
  if (!await transition(db, draft, { status: 'review', attempt_id: attempt })) {
    throw new RequestError(409, 'This draft changed during upload. Refresh and try again.')
  }
  return { id: draft.id }
}

async function generate(db, draft, photo) {
  if (!EDITABLE.includes(draft.status)) {
    throw new RequestError(409, 'This draft is already being processed.')
  }

  const endpoint = process.env.IMAGE_PAIR_N8N_WEBHOOK_URL
  const secret = process.env.IMAGE_PAIR_N8N_WEBHOOK_SECRET
  if (!endpoint || !secret) throw new RequestError(503, 'The image worker is not configured.')
  if (draft.status === 'awaiting_source' && draft.source === 'unsplash') await importPhoto(db, draft, photo)

  const storage = db.storage.from(DRAFTS)
  const imageUrl = await getOriginal(storage, draft.id, 1800)

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
      body: JSON.stringify({ imageUrl, outputUrl, failureUrl }),
      signal: AbortSignal.timeout(8_000),
    })
    if ([401, 403, 404].includes(response.status)) {
      const nextState = draft.status === 'review'
        ? { status: 'review', attempt_id: draft.attempt_id }
        : { status: 'failed' }
      await transition(db, job, nextState)
      const message = response.status === 404
        ? 'The n8n webhook was not found. Check the production URL and publish the workflow.'
        : 'n8n rejected the webhook key. Match the published webhook’s X-Image-Worker-Key credential to IMAGE_PAIR_N8N_WEBHOOK_SECRET.'
      throw new RequestError(502, message)
    }
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}`)
    const acknowledgement = await response.json()
    if (acknowledgement.accepted !== true) throw new Error('Unexpected worker response')
  } catch (error) {
    if (error instanceof RequestError) throw error
    console.error('image worker dispatch:', error.name, error.message)
    // Leave ambiguous dispatches pending so an accepted job can still finish.
    throw new RequestError(502, 'The worker did not confirm receipt. The queue will show the result or time out.')
  }
}

export async function getDraft(db, id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new RequestError(400, 'Invalid draft ID.')
  const draft = unwrap(await db.from(TABLE).select().eq('id', id).maybeSingle())
  if (!draft) throw new RequestError(404, 'Draft not found.')
  return refreshGeneration(db, draft)
}

export function draftVersion(draft) {
  return `${draft.updated_at}/${draft.status}/${draft.attempt_id ?? ''}`
}

export async function saveAnalyzedCounterpart(db, draft, { version, image, brief }) {
  if (version !== draftVersion(draft)) throw new RequestError(409, 'This draft changed during generation.')
  if (!EDITABLE.includes(draft.status)) throw new RequestError(409, 'This draft is no longer editable.')
  const storage = db.storage.from(DRAFTS)
  await getOriginal(storage, draft.id, 60)
  const attempt = randomUUID()
  unwrap(await storage.upload(outputPath(draft.id, attempt), image, { contentType: 'image/jpeg' }))
  unwrap(await storage.upload(briefPath(draft.id, attempt), JSON.stringify(brief), {
    contentType: 'application/json',
  }))
  if (!await transition(db, draft, { status: 'review', attempt_id: attempt })) {
    throw new RequestError(409, 'This draft changed during upload. The newer draft was preserved.')
  }
  return { id: draft.id }
}

async function publishReplacement(db, draft, filename, resume) {
  if (!LIBRARY_JPEG.test(filename) || filename.includes('..')) throw new Error('Invalid replacement filename')
  const staging = db.storage.from(DRAFTS)
  const live = db.storage.from(PUBLIC)
  const [original, currentOriginal, previous, current, candidate] = (await Promise.all([
    staging.download(originalPath(draft.id)),
    live.download(`real/${filename}`),
    staging.download(previousAiPath(draft.id)),
    live.download(`ai/${filename}`),
    staging.download(outputPath(draft.id, draft.attempt_id)),
  ])).map(unwrap)
  const [reference, liveReference, backup, currentAi, replacement] = await Promise.all(
    [original, currentOriginal, previous, current, candidate].map(async file => Buffer.from(await file.arrayBuffer())),
  )
  const alreadyApplied = resume && currentAi.equals(replacement)
  if (!reference.equals(liveReference) || (!alreadyApplied && !backup.equals(currentAi))) {
    throw new RequestError(409, 'The library pair changed after this draft was created. Prepare a fresh replacement.')
  }
  const lock = await transition(db, draft, { status: 'publishing' })
  if (!lock) throw new RequestError(409, 'This draft was updated. Refresh the queue.')
  if (!alreadyApplied) {
    unwrap(await live.upload(`ai/${filename}`, candidate, {
      contentType: 'image/jpeg', cacheControl: '0', upsert: true,
    }))
  }
  if (!await transition(db, lock, { status: 'published' })) throw new Error('Publish lock changed')
  return filename
}

async function publish(db, draft) {
  const resume = draft.status === 'publishing' && Date.now() - Date.parse(draft.updated_at) >= PUBLISH_TIMEOUT
  if (draft.status !== 'review' && !resume) throw new RequestError(409, 'This pair is not ready to publish.')
  const filenameToReplace = replacementFilename(draft)
  if (filenameToReplace) return publishReplacement(db, draft, filenameToReplace, resume)
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
  const { action, id, photoId, category, page = 1, manual, attempt, version } = req.body ?? {}
  const searchConfigured = Boolean(process.env.UNSPLASH_ACCESS_KEY)
  const importEnabled = unsplashImportEnabled()
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
      const { draft, photo } = await reserveCatalogDraft(db, {
        photoId, category, findByCategory: action === 'generate-category',
      })
      if (manual === true) {
        await importPhoto(db, draft, photo)
        return res.status(201).json({ id: draft.id, photoId: photo.id })
      }
      await generate(db, draft, photo)
      return res.status(202).json({ id: draft.id, photoId: photo.id })
    }
    const current = await getDraft(db, id)
    if (action === 'sign-source') {
      if (current.source !== 'upload' || replacementFilename(current) || current.status !== 'awaiting_source') {
        throw new RequestError(409, 'This draft cannot accept a source upload.')
      }
      const { path, token } = unwrap(await db.storage.from(DRAFTS).createSignedUploadUrl(originalPath(id)))
      return res.json({ id, path, token })
    }
    if (action === 'prepare-source') {
      if (current.source !== 'unsplash' || current.status !== 'awaiting_source') {
        throw new RequestError(409, 'This draft cannot import an original right now.')
      }
      await importPhoto(db, current)
      return res.json({ id })
    }
    if (action === 'sign-counterpart' || action === 'complete-counterpart') {
      return res.json(await counterpartUpload(db, current, { action, attempt, version }))
    }
    if (action === 'generate') {
      await generate(db, current)
      return res.status(202).json({ id })
    }
    if (action === 'publish') return res.json({ filename: await publish(db, current) })
    if (action === 'skip') {
      if (!EDITABLE.includes(current.status) ||
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
