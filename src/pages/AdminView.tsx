import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { supabase } from '@/lib/supabase'
import { fetchSchedule, saveSchedule, getTodayDate, type DailySchedule } from '@/lib/dailyChallenge'
import {
  Loader2,
  Send,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Upload,
} from 'lucide-react'

interface ImagePair {
  name: string
  realUrl: string
  aiUrl: string
}

const AdminView: React.FC = () => {
  // Real Upload State
  const [imageUrl, setImageUrl] = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [prompt, setPrompt] = useState('')
  const [generatedName, setGeneratedName] = useState('')

  // AI Upload State
  const [aiUploadLoading, setAiUploadLoading] = useState(false)
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiUploadStatus, setAiUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [aiAssignedDate, setAiAssignedDate] = useState<string | null>(null)
  const [aiCompressedKb, setAiCompressedKb] = useState<{ before: number; after: number } | null>(
    null,
  )
  const aiFileInputRef = useRef<HTMLInputElement>(null)

  // Tab State
  const [activeTab, setActiveTab] = useState<'images' | 'daily'>('images')

  // Calendar State
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())

  // Daily Challenge State
  const [schedule, setSchedule] = useState<DailySchedule>({})
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // List State
  const [images, setImages] = useState<ImagePair[]>([])
  const [loadingImages, setLoadingImages] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedPair, setSelectedPair] = useState<ImagePair | null>(null)
  const [replacingAi, setReplacingAi] = useState<string | null>(null)
  const replaceAiInputRef = useRef<HTMLInputElement>(null)
  const [missingSlots, setMissingSlots] = useState<Record<string, 'real' | 'ai' | 'both'>>({})
  const [uploadingSlot, setUploadingSlot] = useState<{ name: string; side: 'real' | 'ai' } | null>(
    null,
  )
  const missingSlotInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = async () => {
    setLoadingImages(true)
    try {
      const { data: files, error } = await supabase.storage.from('real-vs-ai').list('real')

      if (error) throw error

      if (files) {
        const validFiles = files.filter(
          (f) => f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'),
        )
        const pairs = validFiles
          .map((file) => ({
            name: file.name,
            realUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data
              .publicUrl,
            aiUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data
              .publicUrl,
            createdAt: file.created_at,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setImages(pairs)
      }
    } catch (error) {
      console.error('Error fetching images:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])

  useEffect(() => {
    fetchSchedule().then((s) => {
      setSchedule(s ?? {})
      setScheduleLoading(false)
    })
  }, [])

  const handleEditChallenge = (date: string) => {
    setSelectedDate(date)
    setSelectedImages(schedule[date]?.images ?? [])
    setScheduleStatus('idle')
  }

  const toggleImageSelection = (filename: string) => {
    setSelectedImages((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename],
    )
  }

  const handleSaveChallenge = async () => {
    if (selectedImages.length === 0) return
    setSaving(true)
    setScheduleStatus('idle')
    const updated = { ...schedule, [selectedDate]: { images: selectedImages } }
    const ok = await saveSchedule(updated)
    if (ok) {
      setSchedule(updated)
      setScheduleStatus('success')
    } else {
      setScheduleStatus('error')
    }
    setSaving(false)
  }

  const handleDeleteChallenge = async (date: string) => {
    if (!confirm(`Delete challenge for ${date}?`)) return
    const updated = { ...schedule }
    delete updated[date]
    const ok = await saveSchedule(updated)
    if (ok) {
      setSchedule(updated)
      if (selectedDate === date) {
        setSelectedImages([])
      }
    }
  }

  // For images.unsplash.com, append crop params so their CDN does entropy-based smart cropping
  const buildFetchUrl = (url: string): string => {
    try {
      const u = new URL(url)
      if (u.hostname === 'images.unsplash.com') {
        u.searchParams.set('w', '1024')
        u.searchParams.set('h', '1024')
        u.searchParams.set('fit', 'crop')
        u.searchParams.set('crop', 'entropy')
        u.searchParams.set('q', '85')
        return u.toString()
      }
    } catch {}
    return url
  }

  const handleLoadImage = async () => {
    if (!imageUrl.trim()) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewDataUrl(null)
    setPreviewBlob(null)
    try {
      const fetchUrl = buildFetchUrl(imageUrl.trim())
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const size = Math.min(img.naturalWidth, img.naturalHeight)
          const sx = (img.naturalWidth - size) / 2
          const sy = (img.naturalHeight - size) / 2
          const canvas = document.createElement('canvas')
          canvas.width = 1024
          canvas.height = 1024
          canvas.getContext('2d')!.drawImage(img, sx, sy, size, size, 0, 0, 1024, 1024)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas export failed'))
                return
              }
              setPreviewBlob(blob)
              setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.9))
              resolve()
            },
            'image/jpeg',
            0.9,
          )
        }
        img.onerror = () =>
          reject(
            new Error(
              "Couldn't load the image. Try using the direct image URL (right-click → Copy Image Address on Unsplash).",
            ),
          )
        img.src = fetchUrl
      })
    } catch (e) {
      setPreviewError((e as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAiFile(e.target.files[0])
      setAiUploadStatus('idle')
      setAiCompressedKb(null)
      setAiAssignedDate(null)
    }
  }

  const handleUpload = async () => {
    if (!previewBlob) return
    setUploadLoading(true)
    setUploadStatus('idle')

    const name = `img_${Date.now().toString(36)}`
    setGeneratedName(name)

    const formData = new FormData()
    formData.append('name', name)
    formData.append('image', new File([previewBlob], `${name}.jpg`, { type: 'image/jpeg' }))

    try {
      const response = await fetch(import.meta.env.VITE_N8N_API_URL as string, {
        method: 'POST',
        headers: { 'real-vs-ai-key': import.meta.env.VITE_API_KEY },
        body: formData,
      })
      if (response.ok) {
        setUploadStatus('success')
        const data = await response.json()
        setPrompt(data.prompt)
        fetchImages()
      } else {
        setUploadStatus('error')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setUploadStatus('error')
    } finally {
      setUploadLoading(false)
    }
  }

  const compressImage = (file: File, maxSize = 1024, quality = 0.85): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
          'image/jpeg',
          quality,
        )
      }
      img.onerror = () => reject(new Error('Failed to load image for compression'))
      img.src = url
    })

  const handleAiUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiFile) return

    setAiUploadLoading(true)
    setAiUploadStatus('idle')

    try {
      const compressed = await compressImage(aiFile)
      setAiCompressedKb({
        before: Math.round(aiFile.size / 1024),
        after: Math.round(compressed.size / 1024),
      })
      const { error } = await supabase.storage
        .from('real-vs-ai')
        .upload(`ai/${generatedName}.jpg`, compressed, {
          cacheControl: '0',
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (error) throw error

      // Auto-assign to the first upcoming date with no challenge
      const today = getTodayDate()
      const scheduledDates = new Set(Object.keys(schedule))
      let assignedDate: string | null = null
      const candidate = new Date(today + 'T12:00:00')
      for (let i = 0; i < 60; i++) {
        const yyyy = candidate.getFullYear()
        const mm = String(candidate.getMonth() + 1).padStart(2, '0')
        const dd = String(candidate.getDate()).padStart(2, '0')
        const dateStr = `${yyyy}-${mm}-${dd}`
        if (!scheduledDates.has(dateStr)) {
          assignedDate = dateStr
          break
        }
        candidate.setDate(candidate.getDate() + 1)
      }

      if (assignedDate) {
        const updated = { ...schedule, [assignedDate]: { images: [generatedName + '.jpg'] } }
        await saveSchedule(updated)
        setSchedule(updated)
        // Jump calendar to that month so the user sees the assignment
        const d = new Date(assignedDate + 'T12:00:00')
        setCalendarMonth(d.getMonth())
        setCalendarYear(d.getFullYear())
        setSelectedDate(assignedDate)
        setSelectedImages([generatedName + '.jpg'])
      }

      setAiUploadStatus(assignedDate ? 'success' : 'success')
      setAiAssignedDate(assignedDate)
      setAiFile(null)
      if (aiFileInputRef.current) aiFileInputRef.current.value = ''
      fetchImages()
    } catch (error) {
      console.error('Error uploading AI image:', error)
      setAiUploadStatus('error')
    } finally {
      setAiUploadLoading(false)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return

    setDeleting(filename)
    console.log('deleting', filename)
    try {
      const { error } = await supabase.storage
        .from('real-vs-ai')
        .remove([`real/${filename}`, `ai/${filename}`])

      if (error) throw error

      await fetchImages()
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Failed to delete image')
    } finally {
      setDeleting(null)
    }
  }

  const handleReplaceAiClick = (filename: string) => {
    setReplacingAi(filename)
    replaceAiInputRef.current?.click()
  }

  const handleReplaceAiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !replacingAi) return

    const file = e.target.files[0]
    const filename = replacingAi

    try {
      const compressed = await compressImage(file)
      const { error } = await supabase.storage
        .from('real-vs-ai')
        .upload(`ai/${filename}`, compressed, {
          cacheControl: '0',
          upsert: true,
          contentType: 'image/jpeg',
        })

      if (error) throw error

      // Refresh list
      await fetchImages()
      alert('AI Image replaced successfully!')
    } catch (error) {
      console.error('Error replacing AI image:', error)
      alert('Failed to replace AI image')
    } finally {
      setReplacingAi(null)
      if (replaceAiInputRef.current) replaceAiInputRef.current.value = ''
    }
  }

  const markMissing = (name: string, side: 'real' | 'ai') => {
    setMissingSlots((prev) => {
      const existing = prev[name]
      if (existing === 'both') return prev
      if ((existing === 'real' && side === 'ai') || (existing === 'ai' && side === 'real'))
        return { ...prev, [name]: 'both' }
      return { ...prev, [name]: side }
    })
  }

  const handleMissingSlotClick = (name: string, side: 'real' | 'ai', e: React.MouseEvent) => {
    e.stopPropagation()
    setUploadingSlot({ name, side })
    missingSlotInputRef.current?.click()
  }

  const handleMissingSlotFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !uploadingSlot) return
    const file = e.target.files[0]
    const { name, side } = uploadingSlot
    try {
      const toUpload = side === 'ai' ? await compressImage(file) : file
      const { error } = await supabase.storage
        .from('real-vs-ai')
        .upload(`${side}/${name}`, toUpload, {
          cacheControl: '0',
          upsert: true,
          ...(side === 'ai' && { contentType: 'image/jpeg' }),
        })
      if (error) throw error
      setMissingSlots((prev) => {
        const updated = { ...prev }
        if (updated[name] === 'both') updated[name] = side === 'real' ? 'ai' : 'real'
        else delete updated[name]
        return updated
      })
      await fetchImages()
    } catch (err) {
      console.error('Failed to upload missing image:', err)
      alert('Upload failed')
    } finally {
      setUploadingSlot(null)
      if (missingSlotInputRef.current) missingSlotInputRef.current.value = ''
    }
  }

  // Images used in other days (not the currently-edited date)
  const usedInOtherDays = new Set(
    Object.entries(schedule)
      .filter(([date]) => date !== selectedDate)
      .flatMap(([, entry]) => Array.isArray(entry?.images) ? entry.images : []),
  )

  return (
    <GameLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit mb-6">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'images'
                  ? 'bg-white/10 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Images
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'daily'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Daily Challenges
            </button>
          </div>

          {activeTab === 'images' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Upload Section */}
              <div className="lg:col-span-1 space-y-6">
                {/* Real Image Upload */}
                <Card className="text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-400" />
                      Step 1: Real Image
                    </CardTitle>
                    <CardDescription>Paste an Unsplash URL to fetch & crop</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Image URL</label>
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          placeholder="https://images.unsplash.com/..."
                          value={imageUrl}
                          onChange={(e) => {
                            setImageUrl(e.target.value)
                            setPreviewDataUrl(null)
                            setPreviewBlob(null)
                            setPreviewError(null)
                            setUploadStatus('idle')
                          }}
                          className="bg-slate-900/50 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleLoadImage}
                          disabled={previewLoading || !imageUrl.trim()}
                          className="shrink-0"
                        >
                          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use the direct image URL — right-click → <em>Copy Image Address</em> on
                        Unsplash. Unsplash images are auto-cropped by subject.
                      </p>
                    </div>

                    {previewError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                        {previewError}
                      </div>
                    )}

                    {previewDataUrl && (
                      <div className="space-y-3">
                        <div className="aspect-square rounded-lg overflow-hidden border border-white/10">
                          <img
                            src={previewDataUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          1024×1024 — looks good? Hit Send to n8n.
                        </p>
                      </div>
                    )}

                    {uploadStatus === 'success' && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs space-y-2">
                        <div className="font-bold">Prompt returned — use this in Gemini:</div>
                        <div
                          className="bg-slate-900/50 p-2 rounded font-mono break-words cursor-pointer hover:bg-slate-900/80 transition-colors select-all"
                          title="Click to select all"
                          onClick={(e) => {
                            const range = document.createRange()
                            range.selectNodeContents(e.currentTarget)
                            window.getSelection()?.removeAllRanges()
                            window.getSelection()?.addRange(range)
                          }}
                        >
                          {prompt}
                        </div>
                        <p className="text-muted-foreground">
                          File saved as{' '}
                          <span className="font-mono text-white">{generatedName}.jpg</span>
                        </p>
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                        Pipeline failed — check n8n.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="neon"
                      className="w-full"
                      onClick={handleUpload}
                      disabled={uploadLoading || !previewBlob}
                    >
                      {uploadLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send to n8n
                    </Button>
                  </CardFooter>
                </Card>

                {/* AI Image Upload */}
                <Card className="text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-purple-400" />
                      Step 2: AI Image
                    </CardTitle>
                    <CardDescription>Upload generated AI image</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleAiUpload}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">AI Image</label>
                        <div
                          className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-purple-500 transition-colors cursor-pointer bg-slate-900/30"
                          onClick={() => aiFileInputRef.current?.click()}
                        >
                          <input
                            type="file"
                            ref={aiFileInputRef}
                            onChange={handleAiFileChange}
                            accept="image/*"
                            className="hidden"
                            required
                          />
                          {aiFile ? (
                            <div className="text-sm text-purple-400 font-medium truncate">
                              {aiFile.name}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Upload className="w-6 h-6" />
                              <span className="text-xs">Click to upload</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {aiUploadStatus === 'success' && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs space-y-1">
                          <div className="font-bold">AI image uploaded!</div>
                          {aiCompressedKb && (
                            <div className="text-muted-foreground font-mono">
                              {aiCompressedKb.before > 1024
                                ? `${(aiCompressedKb.before / 1024).toFixed(1)} MB`
                                : `${aiCompressedKb.before} KB`}{' '}
                              → <span className="text-green-400">{aiCompressedKb.after} KB</span> (
                              {Math.round((1 - aiCompressedKb.after / aiCompressedKb.before) * 100)}
                              % smaller)
                            </div>
                          )}
                          {aiAssignedDate && (
                            <div className="text-muted-foreground">
                              Auto-assigned to{' '}
                              <span className="text-green-400 font-medium">
                                {new Date(aiAssignedDate + 'T12:00:00').toLocaleDateString(
                                  undefined,
                                  {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  },
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {aiUploadStatus === 'error' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                          Upload failed.
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full border-purple-500 bg-purple-500" type="submit">
                        {aiUploadLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Upload AI
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </div>

              {/* List Section */}
              <div className="lg:col-span-2">
                <Card className="h-full text-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Existing Images</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchImages}
                        disabled={loadingImages}
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingImages ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingImages ? (
                      <div className="text-center py-10 text-muted-foreground">
                        Loading images...
                      </div>
                    ) : images.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        No images found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {images.map((img) => (
                          <div
                            key={img.name}
                            className="bg-slate-900/50 rounded-lg p-3 border border-white/10 space-y-3 cursor-pointer hover:border-indigo-500/50 transition-colors"
                            onClick={() => setSelectedPair(img)}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="font-medium truncate flex-1 text-white"
                                title={img.name}
                              >
                                {img.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(img.name)
                                  }}
                                  disabled={deleting === img.name}
                                >
                                  {deleting === img.name ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 border-purple-500/50 hover:bg-purple-500/10 text-purple-400"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleReplaceAiClick(img.name)
                                  }}
                                  title="Replace AI Image"
                                >
                                  {replacingAi === img.name ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(['real', 'ai'] as const).map((side) => {
                                const url = side === 'real' ? img.realUrl : img.aiUrl
                                const isMissing =
                                  missingSlots[img.name] === side ||
                                  missingSlots[img.name] === 'both'
                                const isUploading =
                                  uploadingSlot?.name === img.name && uploadingSlot?.side === side
                                return (
                                  <div key={side} className="space-y-1">
                                    <div className="text-xs text-muted-foreground text-center capitalize">
                                      {side}
                                    </div>
                                    <div className="aspect-square rounded overflow-hidden bg-black/20 relative">
                                      {isMissing ? (
                                        <button
                                          className="w-full h-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-red-500/40 hover:border-red-400/70 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                                          onClick={(e) => handleMissingSlotClick(img.name, side, e)}
                                          title={`Upload missing ${side} image`}
                                        >
                                          {isUploading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-red-400" />
                                          ) : (
                                            <>
                                              <Upload className="w-5 h-5 text-red-400" />
                                              <span className="text-xs text-red-400 font-medium">
                                                Missing
                                              </span>
                                            </>
                                          )}
                                        </button>
                                      ) : (
                                        <img
                                          src={url}
                                          className="w-full h-full object-cover"
                                          alt={side}
                                          onError={() => markMissing(img.name, side)}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'daily' && (
            <>
              <h2 className="text-xl font-semibold mb-4 text-amber-400 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daily Challenges
              </h2>

              {scheduleLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Create / Edit */}
                  <Card className="text-white">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {schedule[selectedDate] ? 'Edit Challenge' : 'New Challenge'}
                      </CardTitle>
                      <CardDescription>Select images for a specific date</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date</label>
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value)
                            setSelectedImages(schedule[e.target.value]?.images ?? [])
                            setScheduleStatus('idle')
                          }}
                          className="bg-slate-900/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Images{' '}
                          <span
                            className={`text-xs ${selectedImages.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}
                          >
                            ({selectedImages.length} selected)
                          </span>
                        </label>
                        {loadingImages ? (
                          <div className="text-sm text-muted-foreground">Loading images...</div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                            {images.map((img) => {
                              const checked = selectedImages.includes(img.name)
                              const usedElsewhere = usedInOtherDays.has(img.name)
                              const disabled = usedElsewhere && !checked
                              // Find which date uses this image
                              const usedOnDate = usedElsewhere
                                ? Object.entries(schedule).find(
                                    ([date, entry]) =>
                                      date !== selectedDate && entry.images.includes(img.name),
                                  )?.[0]
                                : undefined
                              return (
                                <div
                                  key={img.name}
                                  role="checkbox"
                                  aria-checked={checked}
                                  onClick={() => !disabled && toggleImageSelection(img.name)}
                                  className={`flex items-center gap-3 p-2 rounded-lg border transition-colors select-none ${
                                    disabled
                                      ? 'border-white/5 opacity-40 cursor-not-allowed'
                                      : checked
                                        ? 'border-amber-500/50 bg-amber-500/10 cursor-pointer'
                                        : 'border-white/10 hover:border-white/20 cursor-pointer'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${checked ? 'bg-amber-500 border-amber-500' : 'border-white/30'}`}>
                                    {checked && <span className="text-black text-[10px] font-bold">✓</span>}
                                  </div>
                                  <img
                                    src={img.realUrl}
                                    alt={img.name}
                                    className="w-10 h-10 rounded object-cover shrink-0"
                                    onError={(e) => {
                                      ;(e.target as HTMLImageElement).src =
                                        'https://placehold.co/40x40?text=?'
                                    }}
                                  />
                                  <span className="text-sm truncate flex-1">{img.name}</span>
                                  {checked && (
                                    <span className="text-amber-400 text-xs font-medium shrink-0">
                                      #{selectedImages.indexOf(img.name) + 1}
                                    </span>
                                  )}
                                  {usedElsewhere && !checked && usedOnDate && (
                                    <span className="text-xs text-muted-foreground shrink-0 font-mono">
                                      {usedOnDate}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {scheduleStatus === 'success' && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs text-center">
                          Challenge saved!
                        </div>
                      )}
                      {scheduleStatus === 'error' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                          Save failed. Try again.
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="neon"
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 border-amber-500/50"
                        onClick={handleSaveChallenge}
                        disabled={saving || selectedImages.length === 0}
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Calendar className="mr-2 h-4 w-4" />
                        )}
                        Save Challenge
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Right: Calendar */}
                  {(() => {
                    const today = getTodayDate()
                    const firstDay = new Date(calendarYear, calendarMonth, 1)
                    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
                    // Start week on Monday: 0=Mon…6=Sun
                    const startDow = (firstDay.getDay() + 6) % 7
                    const cells: (number | null)[] = [
                      ...Array(startDow).fill(null),
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                    ]
                    // Pad to full weeks
                    while (cells.length % 7 !== 0) cells.push(null)

                    const monthLabel = firstDay.toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    })

                    const prevMonth = () => {
                      if (calendarMonth === 0) {
                        setCalendarMonth(11)
                        setCalendarYear((y) => y - 1)
                      } else setCalendarMonth((m) => m - 1)
                    }
                    const nextMonth = () => {
                      if (calendarMonth === 11) {
                        setCalendarMonth(0)
                        setCalendarYear((y) => y + 1)
                      } else setCalendarMonth((m) => m + 1)
                    }

                    return (
                      <Card className="text-white">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Schedule</CardTitle>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={prevMonth}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <span className="text-sm font-medium w-36 text-center">
                                {monthLabel}
                              </span>
                              <button
                                onClick={nextMonth}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {/* Day headers */}
                          <div className="grid grid-cols-7 mb-1">
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
                              <div
                                key={d}
                                className="text-center text-xs text-muted-foreground py-1"
                              >
                                {d}
                              </div>
                            ))}
                          </div>
                          {/* Day cells */}
                          <div className="grid grid-cols-7 gap-y-1">
                            {cells.map((day, i) => {
                              if (!day) return <div key={i} />
                              const mm = String(calendarMonth + 1).padStart(2, '0')
                              const dd = String(day).padStart(2, '0')
                              const dateStr = `${calendarYear}-${mm}-${dd}`
                              const isToday = dateStr === today
                              const isSelected = dateStr === selectedDate
                              const hasChallenge = !!schedule[dateStr]
                              const isPast = dateStr < today

                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (hasChallenge) handleEditChallenge(dateStr)
                                    else {
                                      setSelectedDate(dateStr)
                                      setSelectedImages([])
                                      setScheduleStatus('idle')
                                    }
                                  }}
                                  title={
                                    hasChallenge
                                      ? `${schedule[dateStr].images.length} images`
                                      : undefined
                                  }
                                  className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-sm transition-colors
                                ${isSelected ? 'bg-amber-500/30 text-amber-300 font-bold' : ''}
                                ${!isSelected && hasChallenge ? 'hover:bg-amber-500/10' : ''}
                                ${!isSelected && !hasChallenge ? 'hover:bg-white/5' : ''}
                                ${!hasChallenge && isPast && !isSelected ? 'text-muted-foreground/40' : ''}
                                ${isToday && !isSelected ? 'ring-1 ring-white/30 rounded-lg' : ''}
                              `}
                                >
                                  <span>{day}</span>
                                  {hasChallenge && (
                                    <span
                                      className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-amber-300' : 'bg-amber-500'}`}
                                    />
                                  )}
                                </button>
                              )
                            })}
                          </div>

                          {/* Selected day actions */}
                          {schedule[selectedDate] && (
                            <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString(
                                    undefined,
                                    { weekday: 'short', month: 'short', day: 'numeric' },
                                  )}
                                  {' · '}
                                  <span className="text-amber-400">
                                    {schedule[selectedDate].images.length} images
                                  </span>
                                </p>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleDeleteChallenge(selectedDate)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              </div>
                              {/* Thumbnail strip */}
                              <div className="flex flex-col gap-2">
                                {schedule[selectedDate].images.map((filename) => {
                                  const pair = images.find((img) => img.name === filename)
                                  return (
                                    <div key={filename} className="flex items-center gap-2">
                                      <div className="flex gap-1 shrink-0">
                                        <div className="w-12 h-12 rounded overflow-hidden bg-black/30 border border-indigo-500/20">
                                          <img
                                            src={pair?.realUrl ?? supabase.storage.from('real-vs-ai').getPublicUrl(`real/${filename}`).data.publicUrl}
                                            alt={`real ${filename}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48?text=?' }}
                                          />
                                        </div>
                                        <div className="w-12 h-12 rounded overflow-hidden bg-black/30 border border-purple-500/20">
                                          <img
                                            src={pair?.aiUrl ?? supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${filename}`).data.publicUrl}
                                            alt={`ai ${filename}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48?text=?' }}
                                          />
                                        </div>
                                      </div>
                                      <span className="text-xs text-muted-foreground truncate flex-1 font-mono" title={filename}>
                                        {filename}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      <Dialog open={!!selectedPair} onOpenChange={(open) => !open && setSelectedPair(null)}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{selectedPair?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div className="space-y-3">
              <div className="text-center font-bold text-indigo-400 bg-indigo-500/10 py-2 rounded-lg">
                Real Image
              </div>
              <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-indigo-500/20">
                <img
                  src={selectedPair?.realUrl}
                  className="w-full h-full object-contain bg-black/40"
                  alt="Real"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-center font-bold text-purple-400 bg-purple-500/10 py-2 rounded-lg">
                AI Generated
              </div>
              <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-purple-500/20">
                <img
                  src={selectedPair?.aiUrl}
                  className="w-full h-full object-contain bg-black/40"
                  alt="AI"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden input for replacing AI image */}
      <input
        type="file"
        ref={replaceAiInputRef}
        onChange={handleReplaceAiFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Hidden input for uploading missing real/AI slots */}
      <input
        type="file"
        ref={missingSlotInputRef}
        onChange={handleMissingSlotFileChange}
        accept="image/*"
        className="hidden"
      />
    </GameLayout>
  )
}

export default AdminView
