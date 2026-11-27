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
import ImagePairStudio from '@/components/ImagePairStudio'
import { useAuth, useUser } from '@clerk/react'
import { supabase } from '@/lib/supabase'
import { adminUpload, adminRemove } from '@/lib/adminStorage'
import { fetchSchedule, saveChallenge, getTodayDate, type DailySchedule } from '@/lib/dailyChallenge'
import {
  Loader2,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
} from 'lucide-react'

interface ImagePair {
  name: string
  realUrl: string
  aiUrl: string
}

const AdminView: React.FC = () => {
  const { user, isLoaded: userLoaded } = useUser()
  const { getToken } = useAuth()
  const isAdmin = user?.publicMetadata?.role === 'admin'

  // Tab State
  const [activeTab, setActiveTab] = useState<'drafts' | 'images' | 'daily'>('drafts')

  // Calendar State
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())

  // Daily Challenge State
  const [schedule, setSchedule] = useState<DailySchedule>({})
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(getTodayDate())
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

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
      if (s) {
        setSchedule(s)
        setSelectedImages(s[getTodayDate()]?.images ?? [])
      } else {
        setScheduleError('Could not load the schedule. Refresh to try again.')
      }
      setScheduleLoading(false)
    })
  }, [])

  const handleEditChallenge = (date: string) => {
    setSelectedDate(date)
    setSelectedImages(schedule[date]?.images ?? [])
    setScheduleSaved(false)
    setScheduleError('')
  }

  const toggleImageSelection = (filename: string) => {
    setSelectedImages((prev) =>
      prev.length === 1 && prev[0] === filename ? [] : [filename],
    )
  }

  const updateChallenge = async (date: string, images: string[] | null) => {
    setSaving(true)
    setScheduleSaved(false)
    setScheduleError('')
    try {
      setSchedule(await saveChallenge(date, images, getToken))
      setSelectedImages(images ?? [])
      setScheduleSaved(images !== null)
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not update the schedule.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChallenge = async (date: string) => {
    if (!confirm(`Delete challenge for ${date}?`)) return
    await updateChallenge(date, null)
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

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return

    setDeleting(filename)
    console.log('deleting', filename)
    try {
      await adminRemove(getToken, [`real/${filename}`, `ai/${filename}`])

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
      await adminUpload(getToken, `ai/${filename}`, compressed, {
        cacheControl: '0',
        contentType: 'image/jpeg',
      })

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
      await adminUpload(getToken, `${side}/${name}`, toUpload, {
        cacheControl: '0',
        ...(side === 'ai' && { contentType: 'image/jpeg' }),
      })
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
      .flatMap(([, entry]) => (Array.isArray(entry?.images) ? entry.images : [])),
  )

  if (!userLoaded) return null

  if (!isAdmin) {
    return (
      <GameLayout>
        <div className="max-w-md mx-auto text-center text-muted-foreground">
          This page is for admins only.
        </div>
      </GameLayout>
    )
  }

  return (
    <GameLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="type-display text-4xl leading-none mb-6">Admin dashboard.</h1>

          {/* Tab bar */}
          <div className="flex w-fit max-w-full flex-wrap mb-6 border-4 border-ink">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-4 py-2.5 type-label text-sm transition-colors cursor-pointer ${
                activeTab === 'drafts' ? 'bg-ink text-paper' : 'text-ink hover:bg-muted'
              }`}
            >
              Draft pairs
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-4 py-2.5 type-label text-sm transition-colors cursor-pointer ${
                activeTab === 'images'
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-muted'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Images
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2.5 type-label text-sm transition-colors cursor-pointer ${
                activeTab === 'daily'
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-muted'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Daily Challenges
            </button>
          </div>

          {activeTab === 'drafts' && <ImagePairStudio getToken={getToken} onPublished={fetchImages} />}

          {activeTab === 'images' && (
            <div>
              <div>
                <Card className="h-full">
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
                            className="bg-paper p-3 border-4 border-ink space-y-3 cursor-pointer hover:border-side-b transition-colors"
                            onClick={() => setSelectedPair(img)}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="font-semibold truncate flex-1 text-ink"
                                title={img.name}
                              >
                                {img.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-10 w-10"
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
                                  className="h-10 w-10 text-ink"
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
                                    <div className="aspect-square overflow-hidden bg-muted relative border-2 border-ink">
                                      {isMissing ? (
                                        <button
                                          className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-ink text-paper hover:brightness-125 transition-[filter] cursor-pointer"
                                          onClick={(e) => handleMissingSlotClick(img.name, side, e)}
                                          title={`Upload missing ${side} image`}
                                        >
                                          {isUploading ? (
                                            <Loader2 className="w-5 h-5 animate-spin text-paper" />
                                          ) : (
                                            <>
                                              <Upload className="w-5 h-5 text-paper" strokeWidth={2.5} />
                                              <span className="type-label text-xs text-paper">
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
              <h2 className="type-display text-2xl mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daily Challenges
              </h2>

              {scheduleLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-ink" strokeWidth={3} />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Create / Edit */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {schedule[selectedDate] ? 'Edit Challenge' : 'New Challenge'}
                      </CardTitle>
                      <CardDescription>Dates fill automatically with one unused pair. Choose a pair here to set it manually.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="type-label text-sm">Date</label>
                        <Input
                          type="date"
                          value={selectedDate}
                          disabled={saving}
                          onChange={(e) => handleEditChallenge(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="type-label text-sm">
                          Image pair{' '}
                          <span
                            className={`text-xs ${selectedImages.length > 0 ? 'text-ink font-semibold' : 'text-muted-foreground'}`}
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
                              const disabled = saving || (usedElsewhere && !checked)
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
                                  className={`flex items-center gap-3 p-2 border-2 transition-colors select-none ${
                                    disabled
                                      ? 'border-muted opacity-40 cursor-not-allowed'
                                      : checked
                                        ? 'border-ink bg-side-a-tint cursor-pointer'
                                        : 'border-transparent hover:border-ink cursor-pointer'
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 border-2 border-ink shrink-0 flex items-center justify-center ${checked ? 'bg-ink' : 'bg-paper'}`}
                                  >
                                    {checked && (
                                      <Check className="w-3.5 h-3.5 text-paper" strokeWidth={3} />
                                    )}
                                  </div>
                                  <img
                                    src={img.realUrl}
                                    alt={img.name}
                                    className="w-10 h-10 object-cover shrink-0"
                                    onError={(e) => {
                                      ;(e.target as HTMLImageElement).src =
                                        'https://placehold.co/40x40?text=?'
                                    }}
                                  />
                                  <span className="text-sm truncate flex-1">{img.name}</span>
                                  {checked && (
                                    <span className="type-label text-xs shrink-0">
                                      #{selectedImages.indexOf(img.name) + 1}
                                    </span>
                                  )}
                                  {usedElsewhere && !checked && usedOnDate && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {usedOnDate}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {scheduleSaved && (
                        <div className="p-3 border-4 border-ink text-ink font-medium text-xs text-center">
                          Challenge saved!
                        </div>
                      )}
                      {scheduleError && (
                        <div className="p-3 bg-ink text-paper font-medium text-xs text-center">
                          {scheduleError}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={() => updateChallenge(selectedDate, selectedImages)}
                        disabled={saving || !selectedDate || selectedImages.length !== 1}
                      >
                        {saving ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Calendar className="h-5 w-5" />
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
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Schedule</CardTitle>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={prevMonth}
                                className="p-1.5 hover:bg-ink hover:text-paper transition-colors cursor-pointer"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <span className="type-label text-sm w-40 text-center">
                                {monthLabel}
                              </span>
                              <button
                                onClick={nextMonth}
                                className="p-1.5 hover:bg-ink hover:text-paper transition-colors cursor-pointer"
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
                                  disabled={saving}
                                  onClick={() => handleEditChallenge(dateStr)}
                                  title={
                                    hasChallenge
                                      ? `${schedule[dateStr].images.length} images`
                                      : undefined
                                  }
                                  className={`relative flex flex-col items-center justify-center py-1.5 text-sm font-semibold transition-colors cursor-pointer
                                ${isSelected ? 'bg-ink text-paper font-bold' : ''}
                                ${!isSelected && hasChallenge ? 'hover:bg-muted' : ''}
                                ${!isSelected && !hasChallenge ? 'hover:bg-muted' : ''}
                                ${!hasChallenge && isPast && !isSelected ? 'text-text-placeholder' : ''}
                                ${isToday && !isSelected ? 'outline-2 outline-ink -outline-offset-2' : ''}
                              `}
                                >
                                  <span>{day}</span>
                                  {hasChallenge && (
                                    <span
                                      className="w-1.5 h-1.5 mt-0.5 bg-side-a"
                                    />
                                  )}
                                </button>
                              )
                            })}
                          </div>

                          {/* Selected day actions */}
                          {schedule[selectedDate] && (
                            <div className="mt-4 pt-3 border-t-2 border-ink space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString(
                                    undefined,
                                    { weekday: 'short', month: 'short', day: 'numeric' },
                                  )}
                                  {' · '}
                                  <span className="text-ink font-semibold">
                                    {schedule[selectedDate].images.length} images
                                  </span>
                                </p>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => handleDeleteChallenge(selectedDate)}
                                >
                                  <Trash2 />
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
                                        <div className="w-12 h-12 overflow-hidden bg-muted border-2 border-ink">
                                          <img
                                            src={
                                              pair?.realUrl ??
                                              supabase.storage
                                                .from('real-vs-ai')
                                                .getPublicUrl(`real/${filename}`).data.publicUrl
                                            }
                                            alt={`real ${filename}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              ;(e.target as HTMLImageElement).src =
                                                'https://placehold.co/48x48?text=?'
                                            }}
                                          />
                                        </div>
                                        <div className="w-12 h-12 overflow-hidden bg-muted border-2 border-ink">
                                          <img
                                            src={
                                              pair?.aiUrl ??
                                              supabase.storage
                                                .from('real-vs-ai')
                                                .getPublicUrl(`ai/${filename}`).data.publicUrl
                                            }
                                            alt={`ai ${filename}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              ;(e.target as HTMLImageElement).src =
                                                'https://placehold.co/48x48?text=?'
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <span
                                        className="text-xs text-muted-foreground truncate flex-1"
                                        title={filename}
                                      >
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="type-display text-xl pr-12 break-all">{selectedPair?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <div className="space-y-3">
              <div className="text-center type-label bg-side-a text-ink py-2">
                Real Image
              </div>
              <div className="relative aspect-square overflow-hidden border-4 border-ink">
                <img
                  src={selectedPair?.realUrl}
                  className="w-full h-full object-contain bg-muted"
                  alt="Real"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-center type-label bg-ink text-paper py-2">
                AI Generated
              </div>
              <div className="relative aspect-square overflow-hidden border-4 border-ink">
                <img
                  src={selectedPair?.aiUrl}
                  className="w-full h-full object-contain bg-muted"
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
