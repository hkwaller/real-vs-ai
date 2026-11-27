import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import {
  draftVersion, getDraft, importPhoto, listDrafts, reserveCatalogDraft, saveAnalyzedCounterpart,
  unsplashImportEnabled, libraryReplacementCandidates, reserveLibraryReplacement,
} from '../api/admin-image-pairs.js'

const run = promisify(execFile)
const DRAFT_BUCKET = 'real-vs-ai-drafts'

function readyForCodex(draft) {
  return ['awaiting_source', 'failed'].includes(draft.status)
    && (draft.source !== 'unsplash' || unsplashImportEnabled())
}

async function prepare(db, { count, category, draft: id, before }) {
  if (before && (id || category || !/^\d{4}-\d{2}-\d{2}$/.test(before))) throw new Error('Use --before YYYY-MM-DD with --count.')
  if (id && (count !== 1 || category)) throw new Error('Use --draft by itself.')
  const directory = await mkdtemp(join(tmpdir(), 'real-vs-ai-'))
  const manifest = join(directory, 'drafts.json')
  const prepared = []

  async function writeReference(draft, filename) {
    if (!readyForCodex(draft)) throw new Error('The draft is unavailable for this workflow.')
    const { data, error } = await db.storage.from(DRAFT_BUCKET).download(`${draft.id}/real.jpg`)
    if (error) throw error
    const original = join(directory, `${draft.id}.jpg`)
    await writeFile(original, new Uint8Array(await data.arrayBuffer()), { mode: 0o600 })
    prepared.push({ id: draft.id, original, version: draftVersion(draft), category: draft.category, filename })
    await writeFile(manifest, JSON.stringify(prepared, null, 2) + '\n', { mode: 0o600 })
  }

  let warning
  try {
    if (id) {
      await writeReference(await getDraft(db, id))
    } else if (before) {
      for (const candidate of await libraryReplacementCandidates(db, before)) {
        if (prepared.length >= count) break
        const draft = await reserveLibraryReplacement(db, candidate)
        if (draft) await writeReference(draft, candidate.filename)
      }
    } else {
      const queue = await listDrafts(db)
      for (const draft of queue.filter(draft => draft.realUrl && !draft.replacementFilename && readyForCodex(draft)
        && (!category || draft.category?.toLowerCase() === category.toLowerCase())).slice(0, count)) {
        await writeReference(draft)
      }
      while (prepared.length < count && category && unsplashImportEnabled()) {
        const { draft, photo } = await reserveCatalogDraft(db, { category, findByCategory: true })
        await importPhoto(db, draft, photo)
        await writeReference(draft)
      }
    }
  } catch (error) {
    if (!prepared.length) {
      await rm(directory, { recursive: true })
      throw error
    }
    warning = error.message
  }
  if (!prepared.length) {
    await rm(directory, { recursive: true })
    throw new Error('No eligible drafts have a saved original. Upload a photo in Admin → Draft pairs or use an enabled catalog category.')
  }
  if (prepared.length < count && !warning) warning = 'There were fewer eligible originals than requested.'
  console.log(JSON.stringify({ manifest, drafts: prepared, warning }, null, 2))
}

async function imageDimensions(path) {
  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path])
  const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1])
  const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1])
  if (!width || !height) throw new Error('Could not read the image dimensions.')
  return { width, height }
}

async function normalizeJpeg(imagePath, originalPath, directory) {
  const source = resolve(imagePath)
  const [input, reference] = await Promise.all([imageDimensions(source), imageDimensions(originalPath)])
  const ratio = reference.width / reference.height
  const cropWidth = Math.max(1, Math.min(input.width, Math.round(input.height * ratio)))
  const cropHeight = Math.max(1, Math.min(input.height, Math.round(input.width / ratio)))
  const scale = 1024 / Math.max(reference.width, reference.height)
  const width = Math.max(1, Math.round(reference.width * scale))
  const height = Math.max(1, Math.round(reference.height * scale))
  const jpeg = join(directory, 'counterpart.jpg')
  await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90',
    '-c', String(cropHeight), String(cropWidth), source, '--out', jpeg])
  await run('sips', ['-z', String(height), String(width), jpeg])
  return readFile(jpeg)
}

async function stage(db, { draft: id, manifest, image, brief }) {
  if (!id || !manifest || !image || !brief) {
    throw new Error('stage requires --draft, --manifest, --image, and --brief.')
  }
  const reference = JSON.parse(await readFile(manifest, 'utf8')).find(item => item.id === id)
  if (!reference) throw new Error('This draft is missing from the preparation manifest.')
  const analysis = JSON.parse(await readFile(brief, 'utf8'))
  const description = typeof analysis.description === 'string' ? analysis.description.trim() : ''
  const direction = typeof analysis.direction === 'string' ? analysis.direction.trim() : ''
  if (!description || !direction) throw new Error('The brief must include description and direction.')
  const draft = await getDraft(db, id)
  if (!readyForCodex(draft) || draftVersion(draft) !== reference.version) {
    throw new Error('The draft changed since preparation. Prepare it again before staging.')
  }

  const directory = await mkdtemp(join(tmpdir(), 'real-vs-ai-jpeg-'))
  try {
    const normalized = await normalizeJpeg(image, reference.original, directory)
    await saveAnalyzedCounterpart(db, draft, {
      version: reference.version, image: normalized, brief: { description, direction },
    })
    console.log(JSON.stringify({ id, status: 'review' }))
  } finally {
    await rm(directory, { recursive: true })
  }
}

const usage = `Usage:
  node --env-file=.env.local scripts/codex-image-pairs.mjs prepare [--count N] [--category NAME]
  node --env-file=.env.local scripts/codex-image-pairs.mjs prepare --count N --before YYYY-MM-DD
  node --env-file=.env.local scripts/codex-image-pairs.mjs prepare --draft UUID
  node --env-file=.env.local scripts/codex-image-pairs.mjs stage --draft UUID --manifest PATH --image PATH --brief PATH`

try {
  const [command, ...args] = process.argv.slice(2)
  if (!command || command === '--help') {
    console.log(usage)
  } else {
    const { values } = parseArgs({
      args,
      options: {
        count: { type: 'string' }, category: { type: 'string' }, draft: { type: 'string' }, before: { type: 'string' },
        manifest: { type: 'string' }, image: { type: 'string' }, brief: { type: 'string' },
      },
    })
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const count = Number(values.count ?? '1')
    if (!url || !key) throw new Error('Configure the Supabase URL and service-role key in .env.local.')
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('--count must be a positive integer.')
    const db = createClient(url, key, { auth: { persistSession: false } })
    if (command === 'prepare') await prepare(db, { ...values, count, category: values.category?.trim() })
    else if (command === 'stage') await stage(db, values)
    else throw new Error(usage)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
