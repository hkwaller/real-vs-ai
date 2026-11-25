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

  async function upload(id?: string) {
    const file = fileInput.current?.files?.[0]
    if (!file) throw new Error('Choose a photo first.')
    const image = await squareJpeg(file)
    const draft = await request<{ id: string; path: string; token: string }>(
      id ? 'sign-source' : 'create-upload', id ? { id } : {},
    )
    const { error } = await supabase.storage.from('real-vs-ai-drafts')
      .uploadToSignedUrl(draft.path, draft.token, image, { contentType: 'image/jpeg' })
    if (error) throw error
    if (fileInput.current) fileInput.current.value = ''
    await request('generate', { id: draft.id })
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
          <form className="space-y-2" onSubmit={event => {
            event.preventDefault()
            void run('upload', () => upload())
          }}>
            <label className="block type-label text-sm" htmlFor="pair-photo">Upload a photo you own</label>
            <Input id="pair-photo" ref={fileInput} type="file" accept="image/*" required />
            <Button size="sm" disabled={busy !== null}>Generate from upload</Button>
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
                  void run('category', async () => {
                    const { photoId } = await request<{ photoId: string }>('generate-category', { category })
                    setResults(current => current && { ...current, photos: current.photos.filter(photo => photo.id !== photoId) })
                  })
                }}>Generate from category</Button>
              )}
            </div>
            {queue && !queue.searchConfigured && <p className="text-sm text-muted-foreground">Unsplash search is awaiting configuration.</p>}
            {queue?.searchConfigured && !queue.importEnabled && <p className="text-sm text-muted-foreground">Browsing is available. Pair generation from Unsplash is disabled.</p>}
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
                    void run(photo.id, async () => {
                      await request('create-unsplash', { photoId: photo.id, category: results.category })
                      setResults(current => current && { ...current, photos: current.photos.filter(item => item.id !== photo.id) })
                    })
                  }}>Generate pair</Button>}
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
                <h3 className="type-label text-sm">{draft.canResumePublish ? 'Publishing interrupted' : draftStatus[draft.status]}</h3>
                {draft.category && <span className="text-xs text-muted-foreground">{draft.category}</span>}
              </div>
              {(draft.realUrl || draft.aiUrl) && <div className="grid grid-cols-2 gap-2">
                {[{ url: draft.realUrl, label: 'Original' }, { url: draft.aiUrl, label: 'AI' }].map(({ url, label }) => (
                  <figure key={label}>
                    {url ? <img loading="lazy" src={url} alt={label} className="aspect-square w-full border-2 border-ink object-cover" />
                      : <div className="aspect-square border-2 border-ink bg-muted" />}
                    <figcaption className="type-label mt-1 text-xs">{label}</figcaption>
                  </figure>
                ))}
              </div>}
              {draft.source_url && (
                <p className="text-xs">
                  <a className="underline" href={draft.photographer_url ?? draft.source_url} target="_blank" rel="noreferrer">{draft.photographer}</a>
                  {' / '}
                  <a className="underline" href={draft.source_url} target="_blank" rel="noreferrer">Unsplash</a>
                  {draft.source_date && ` · ${draft.source_date}`}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(draft.status === 'review' || draft.canResumePublish) && (
                  <Button size="sm" disabled={busy !== null} onClick={() => void run(draft.id, async () => {
                    const { filename } = await request<{ filename: string }>('publish', { id: draft.id })
                    setMessage(`Published ${filename}. You can assign it under Daily Challenges.`)
                    await onPublished()
                  })}>{draft.canResumePublish ? 'Retry publish' : 'Approve'}</Button>
                )}
                {['review', 'failed', 'awaiting_source'].includes(draft.status) && (
                  <>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(draft.id, async () => {
                      if (draft.status === 'awaiting_source' && !draft.source_url && !draft.realUrl) await upload(draft.id)
                      else await request('generate', { id: draft.id })
                    })}>{draft.status === 'awaiting_source' ? 'Generate' : 'Regenerate'}</Button>
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
