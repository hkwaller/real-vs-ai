import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { GetToken } from '@/lib/adminStorage'
import { supabase } from '@/lib/supabase'

type Draft = {
  id: string
  source_url: string | null
  photographer: string | null
  photographer_url: string | null
  source_date: string | null
  category: string | null
  status: 'awaiting_source' | 'generating' | 'failed' | 'review' | 'publishing'
  realUrl: string | null
  aiUrl: string | null
  briefUrl?: string | null
  replacementFilename?: string | null
  previousAiUrl?: string | null
  attempt_id: string | null
  canResumePublish: boolean
}

type CatalogPhoto = {
  id: string
  imageUrl: string
  sourceUrl: string
  photographer: string
  photographerUrl: string
  description: string | null
  date: string
}

type Queue = { drafts: Draft[]; searchConfigured: boolean; importEnabled: boolean }
type Results = { photos: CatalogPhoto[]; hasMore: boolean }
type UploadTicket = { path: string; token: string }
type GenerationMode = 'chatgpt' | 'n8n'

const CHATGPT_PROMPT = 'Use the attached image as a reference to create a new square photorealistic photograph of the same kind of scene. Match the framing, perspective, lighting, depth of field, and natural colors. Recreate the whole scene and vary a few small details, such as background objects or textures. Avoid added text, borders, and watermarks.'
const EDITABLE = ['awaiting_source', 'failed', 'review']

const TOPICS = ['Wildlife', 'Architecture', 'Food', 'Landscapes', 'Everyday objects']

const draftStatus: Record<Draft['status'], string> = {
  awaiting_source: 'Waiting for a photo',
  generating: 'Generating counterpart',
  failed: 'Generation failed or timed out',
  review: 'Ready for review',
  publishing: 'Publishing pair',
}

async function squareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const size = Math.min(image.naturalWidth, image.naturalHeight)
    if (!size) throw new Error('The photo could not be read.')
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1024
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Image conversion is unavailable.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, 1024, 1024)
    context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2,
      size, size, 0, 0, 1024, 1024)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the photo.')),
        'image/jpeg', 0.9)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function GenerationBrief({ url }: { url: string }) {
  const [brief, setBrief] = useState<{ description: string; direction: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  async function load() {
    if (brief || status === 'loading') return
    setStatus('loading')
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Brief unavailable')
      const data = await response.json()
      if (typeof data.description !== 'string' || typeof data.direction !== 'string') {
        throw new Error('Invalid brief')
      }
      setBrief({ description: data.description, direction: data.direction })
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <details className="space-y-2 border-t-2 border-ink pt-3"
      onToggle={event => { if (event.currentTarget.open) void load() }}>
      <summary className="cursor-pointer type-label text-sm">Image analysis</summary>
      {status === 'loading' && <p role="status" className="text-sm">Loading analysis…</p>}
      {status === 'error' && (
        <Button variant="outline" size="sm" onClick={() => void load()}>Retry loading analysis</Button>
      )}
      {brief && (
        <dl className="space-y-2 text-sm">
          <div><dt className="font-semibold">Original photo</dt><dd className="whitespace-pre-wrap">{brief.description}</dd></div>
          <div><dt className="font-semibold">Generation direction</dt><dd className="whitespace-pre-wrap">{brief.direction}</dd></div>
        </dl>
      )}
    </details>
  )
}

export default function ImagePairStudio({ getToken, onPublished }: {
  getToken: GetToken
  onPublished: () => Promise<void>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const latestRefresh = useRef(0)
  const [queue, setQueue] = useState<Queue | null>(null)
  const [queueError, setQueueError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [mode, setMode] = useState<GenerationMode>('chatgpt')
  const [category, setCategory] = useState('Wildlife')
  const [results, setResults] = useState<(Results & { category: string; page: number }) | null>(null)

  const request = useCallback(async <T,>(action: string, fields: Record<string, unknown> = {}): Promise<T> => {
    const token = await getToken()
    if (!token) throw new Error('Sign in to manage image pairs.')
    const response = await fetch('/api/admin-image-pairs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...fields }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) throw new Error(data?.error ?? 'The image pair API is unavailable.')
    return data
  }, [getToken])

  const refresh = useCallback(async () => {
    const refreshId = ++latestRefresh.current
    try {
      const result = await request<Queue>('list')
      if (refreshId !== latestRefresh.current) return
      setQueue(result)
      setQueueError('')
    } catch (error) {
      if (refreshId === latestRefresh.current) setQueueError((error as Error).message)
    }
  }, [request])

  const isProcessing = queue?.drafts.some(draft => draft.status === 'generating' || draft.status === 'publishing')
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    // Pending jobs are processed by n8n across reloads.
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, isProcessing ? 5000 : 120_000)
    return () => window.clearInterval(timer)
  }, [isProcessing, refresh])

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setActionError('')
    setMessage('')
    try {
      await action()
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      await refresh()
      setBusy(null)
    }
  }

  async function uploadJpeg(ticket: UploadTicket, image: Blob) {
    const { error } = await supabase.storage.from('real-vs-ai-drafts')
      .uploadToSignedUrl(ticket.path, ticket.token, image, { contentType: 'image/jpeg' })
    if (error) throw error
  }

  async function upload(id?: string) {
    const file = fileInput.current?.files?.[0]
    if (!file) throw new Error('Choose a photo first.')
    const image = await squareJpeg(file)
    const draft = await request<UploadTicket & { id: string }>(
      id ? 'sign-source' : 'create-upload', id ? { id } : {},
    )
    await uploadJpeg(draft, image)
    if (fileInput.current) fileInput.current.value = ''
    if (mode === 'n8n') await request('generate', { id: draft.id })
    else setMessage('Original saved. Open its draft to download it and upload the AI counterpart.')
  }

  async function uploadCounterpart(id: string, file: File) {
    const image = await squareJpeg(file)
    const ticket = await request<UploadTicket & { attempt: string; version: string }>(
      'sign-counterpart', { id },
    )
    await uploadJpeg(ticket, image)
    await request('complete-counterpart', { id, attempt: ticket.attempt, version: ticket.version })
    setMessage('Counterpart uploaded. Review the pair before approving.')
  }

  async function downloadOriginal(url: string) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not download the reference. Refresh drafts and try again.')
    const href = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = href
    link.download = 'real-vs-ai-reference.jpg'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }

  async function selectUnsplash(action: 'create-unsplash' | 'generate-category', fields: Record<string, unknown>) {
    const { photoId } = await request<{ photoId: string }>(action, {
      ...fields, manual: mode === 'chatgpt',
    })
    setResults(current => current && {
      ...current, photos: current.photos.filter(photo => photo.id !== photoId),
    })
    if (mode === 'chatgpt') setMessage('Original saved. Open its draft to use it in ChatGPT Images.')
  }

  function search(event: FormEvent) {
    event.preventDefault()
    void findPhotos(category.trim(), 1)
  }

  async function findPhotos(query: string, page: number) {
    await run('search', async () => {
      const next = await request<Results>('search', { category: query, page })
      setResults({ ...next, category: query, page })
    })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader><CardTitle>New image pair</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-2" disabled={busy !== null}>
            <legend className="type-label text-sm">Generation method</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="pair-method" checked={mode === 'chatgpt'}
                  onChange={() => setMode('chatgpt')} />
                ChatGPT Images
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="pair-method" checked={mode === 'n8n'}
                  onChange={() => setMode('n8n')} />
                n8n (API)
              </label>
            </div>
          </fieldset>
          <form className="space-y-2" onSubmit={event => {
            event.preventDefault()
            void run('upload', () => upload())
          }}>
            <label className="block type-label text-sm" htmlFor="pair-photo">Upload a photo you own</label>
            <Input id="pair-photo" ref={fileInput} type="file" accept="image/*" required />
            <Button size="sm" disabled={busy !== null}>{mode === 'chatgpt' ? 'Save original' : 'Generate from upload'}</Button>
          </form>

          <form className="space-y-2 border-t-2 border-ink pt-4" onSubmit={search}>
            <label className="block type-label text-sm" htmlFor="pair-category">Browse Unsplash</label>
            <Input id="pair-category" list="pair-categories" value={category} maxLength={80} required
              onChange={event => setCategory(event.target.value)} />
            <datalist id="pair-categories">
              {TOPICS.map(topic => <option key={topic} value={topic} />)}
            </datalist>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null || !queue?.searchConfigured}>
                Search photos
              </Button>
              {queue?.importEnabled && (
                <Button size="sm" type="button" disabled={busy !== null || !category.trim()} onClick={() => {
                  void run('category', () => selectUnsplash('generate-category', { category }))
                }}>{mode === 'chatgpt' ? 'Find and save a photo' : 'Generate from category'}</Button>
              )}
            </div>
            {queue && !queue.searchConfigured && <p className="text-sm text-muted-foreground">Unsplash search is awaiting configuration.</p>}
            {queue?.searchConfigured && !queue.importEnabled && <p className="text-sm text-muted-foreground">Unsplash is available for browsing.</p>}
          </form>
          {results && (
            <section className="space-y-3" aria-label={`${results.category} search results`}>
              {results.photos.length === 0 && <p className="text-sm">No unused photos from before 2021 on this page.</p>}
              {results.photos.map(photo => (
                <article key={photo.id} className="space-y-2 border-2 border-ink p-2">
                  <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                    <img className="aspect-video w-full object-cover" src={photo.imageUrl} loading="lazy"
                      alt={photo.description ?? 'Unsplash photo'} />
                  </a>
                  <p className="text-xs">
                    <a className="underline" href={photo.photographerUrl} target="_blank" rel="noreferrer">{photo.photographer}</a>
                    {' / '}
                    <a className="underline" href={photo.sourceUrl} target="_blank" rel="noreferrer">Unsplash</a>
                    {' · '}{photo.date}
                  </p>
                  {queue?.importEnabled && <Button size="sm" disabled={busy !== null} onClick={() => {
                    void run(photo.id, () => selectUnsplash('create-unsplash', { photoId: photo.id, category: results.category }))
                  }}>{mode === 'chatgpt' ? 'Save original' : 'Generate pair'}</Button>}
                </article>
              ))}
              {results.hasMore && <Button size="sm" variant="outline" disabled={busy !== null}
                onClick={() => void findPhotos(results.category, results.page + 1)}>Next page</Button>}
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap justify-between gap-2">
          <CardTitle>Draft pairs</CardTitle>
          <Button size="sm" variant="outline" aria-label="Refresh drafts" disabled={busy !== null} onClick={() => void refresh()}>
            <RefreshCw size={16} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Working…</p>}
          {message && <p role="status" className="text-sm">{message}</p>}
          {actionError && <p role="alert" className="text-sm">{actionError}</p>}
          {queueError && <p role="alert" className="text-sm">{queueError}</p>}
          {!queue && !queueError && <p className="text-sm">Loading drafts…</p>}
          {queue?.drafts.length === 0 && <p className="text-sm text-muted-foreground">No drafts to review.</p>}
          {queue?.drafts.map(draft => (
            <article key={draft.id} className="space-y-3 border-2 border-ink p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="type-label text-sm">{draft.canResumePublish ? 'Publishing interrupted'
                  : draft.status === 'awaiting_source' && draft.realUrl ? 'Ready for a counterpart'
                  : draftStatus[draft.status]}</h3>
                {(draft.replacementFilename || draft.category) && (
                  <span className="break-all text-xs text-muted-foreground">{draft.replacementFilename ?? draft.category}</span>
                )}
              </div>
              {(draft.realUrl || draft.aiUrl) && (
                <div className={`grid gap-2 ${draft.replacementFilename ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                  {[
                    { url: draft.realUrl, label: 'Original' },
                    ...(draft.replacementFilename ? [{ url: draft.previousAiUrl, label: 'Current AI' }] : []),
                    { url: draft.aiUrl, label: draft.replacementFilename ? 'Proposed AI' : 'AI' },
                  ].map(({ url, label }) => (
                  <figure key={label}>
                    {url ? <img loading="lazy" src={url} alt={label} className="aspect-square w-full border-2 border-ink object-cover" />
                      : <div className="aspect-square border-2 border-ink bg-muted" />}
                    <figcaption className="type-label mt-1 text-xs">{label}</figcaption>
                  </figure>
                  ))}
                </div>
              )}
              {draft.source_url && (
                <p className="text-xs">
                  <a className="underline" href={draft.photographer_url ?? draft.source_url} target="_blank" rel="noreferrer">{draft.photographer}</a>
                  {' / '}
                  <a className="underline" href={draft.source_url} target="_blank" rel="noreferrer">Unsplash</a>
                  {draft.source_date && ` · ${draft.source_date}`}
                </p>
              )}
              {draft.briefUrl && <GenerationBrief key={draft.attempt_id} url={draft.briefUrl} />}
              {draft.realUrl && EDITABLE.includes(draft.status) && (
                <details className="space-y-3 border-t-2 border-ink pt-3" open={!draft.aiUrl || undefined}>
                  <summary className="cursor-pointer type-label text-sm">Use ChatGPT Images</summary>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy !== null}
                      onClick={() => void run(draft.id, () => downloadOriginal(draft.realUrl!))}>
                      Download original
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null}
                      onClick={() => void run(draft.id, async () => {
                        await navigator.clipboard.writeText(CHATGPT_PROMPT)
                        setMessage('Prompt copied. Attach the original when you paste it in ChatGPT.')
                      })}>Copy prompt</Button>
                    <Button asChild size="sm" variant="link">
                      <a href="https://chatgpt.com/images" target="_blank" rel="noreferrer">Open ChatGPT Images</a>
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <label className="block type-label text-sm" htmlFor={`counterpart-${draft.id}`}>
                      {draft.aiUrl ? 'Replace AI counterpart' : 'Upload AI counterpart'}
                    </label>
                    <Input id={`counterpart-${draft.id}`} type="file" accept="image/*" disabled={busy !== null}
                      onChange={event => {
                        const file = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (file) void run(draft.id, () => uploadCounterpart(draft.id, file))
                      }} />
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                {(draft.status === 'review' || draft.canResumePublish) && (
                  <Button size="sm" disabled={busy !== null} onClick={() => void run(draft.id, async () => {
                    const { filename } = await request<{ filename: string }>('publish', { id: draft.id })
                    setMessage(draft.replacementFilename
                      ? `Updated the AI image for ${filename}.`
                      : `Published ${filename}. It is now eligible for daily challenges.`)
                    await onPublished()
                  })}>{draft.canResumePublish ? 'Retry publish' : draft.replacementFilename ? 'Approve replacement' : 'Approve'}</Button>
                )}
                {EDITABLE.includes(draft.status) && (
                  <>
                    {((mode === 'n8n' && draft.realUrl) || (!draft.replacementFilename && draft.status === 'awaiting_source' && !draft.realUrl)) && (
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(draft.id, async () => {
                        if (draft.status === 'awaiting_source' && !draft.realUrl) {
                          if (!draft.source_url) await upload(draft.id)
                          else if (mode === 'chatgpt') await request('prepare-source', { id: draft.id })
                          else await request('generate', { id: draft.id })
                        } else {
                          await request('generate', { id: draft.id })
                        }
                      })}>{mode === 'chatgpt' ? 'Save original' : draft.status === 'awaiting_source' ? 'Generate' : 'Regenerate'}</Button>
                    )}
                    <Button size="sm" variant="link" disabled={busy !== null} onClick={() => void run(draft.id, async () => {
                      await request('skip', { id: draft.id })
                    })}>Skip</Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
