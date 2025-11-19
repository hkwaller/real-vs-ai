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
import { Input } from '@/components/ui/input'
import GameLayout from '@/components/GameLayout'
import { supabase } from '@/lib/supabase'
import { Loader2, Upload, Send, Trash2, RefreshCw, Image as ImageIcon } from 'lucide-react'

interface ImagePair {
  name: string
  realUrl: string
  aiUrl: string
}

const AdminView: React.FC = () => {
  // Real Upload State
  const [uploadLoading, setUploadLoading] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [prompt, setPrompt] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Upload State
  const [aiUploadLoading, setAiUploadLoading] = useState(false)
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiUploadStatus, setAiUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const aiFileInputRef = useRef<HTMLInputElement>(null)

  // List State
  const [images, setImages] = useState<ImagePair[]>([])
  const [loadingImages, setLoadingImages] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchImages = async () => {
    setLoadingImages(true)
    try {
      const { data: files, error } = await supabase.storage.from('real-vs-ai').list('real')

      if (error) throw error

      if (files) {
        const validFiles = files.filter(
          (f) => f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'),
        )
        const pairs = validFiles.map((file) => ({
          name: file.name,
          realUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`real/${file.name}`).data
            .publicUrl,
          aiUrl: supabase.storage.from('real-vs-ai').getPublicUrl(`ai/${file.name}`).data.publicUrl,
        }))
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleAiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAiFile(e.target.files[0])
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name) return

    setUploadLoading(true)
    setUploadStatus('idle')

    const formData = new FormData()
    formData.append('name', name)
    formData.append('image', file)

    try {
      const response = await fetch(
        'https://n8n.srv1131293.hstgr.cloud/webhook-test/real-vs-ai/generate',
        {
          method: 'POST',
          headers: {
            'real-vs-ai-key': import.meta.env.VITE_API_KEY,
          },
          body: formData,
        },
      )

      if (response.ok) {
        setUploadStatus('success')
        const data = await response.json()
        setPrompt(data.prompt)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        // Refresh list after successful upload
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

  const handleAiUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiFile) return

    setAiUploadLoading(true)
    setAiUploadStatus('idle')

    try {
      const { error } = await supabase.storage.from('real-vs-ai').upload(`ai/${name}.jpg`, aiFile, {
        cacheControl: '0',
        upsert: true,
      })

      if (error) throw error

      setAiUploadStatus('success')
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

  return (
    <GameLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Section */}
            <div className="lg:col-span-1 space-y-6">
              {/* Real Image Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-indigo-400" />
                    Step 1: Real Image
                  </CardTitle>
                  <CardDescription>Upload real image & get prompt</CardDescription>
                </CardHeader>
                <form onSubmit={handleUpload}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        type="text"
                        placeholder="Enter name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-slate-900/50"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Image</label>
                      <div
                        className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer bg-slate-900/30"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                          required
                        />
                        {file ? (
                          <div className="text-sm text-indigo-400 font-medium truncate">
                            {file.name}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="w-6 h-6" />
                            <span className="text-xs">Click to upload</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {uploadStatus === 'success' && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs">
                        <div className="font-bold mb-1">Success!</div>
                        <div className="bg-slate-900/50 p-2 rounded font-mono break-words">
                          {prompt}
                        </div>
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                        Upload failed.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="neon"
                      className="w-full"
                      type="submit"
                      disabled={uploadLoading || !file || !name}
                    >
                      {uploadLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Upload Real
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              {/* AI Image Upload */}
              <Card>
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
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs text-center">
                        AI Image Uploaded!
                      </div>
                    )}

                    {aiUploadStatus === 'error' && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs text-center">
                        Upload failed.
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full border-purple-500/50 hover:bg-purple-500/10"
                      type="submit"
                      disabled={aiUploadLoading || !aiFile}
                    >
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
                    <div className="text-center py-10 text-muted-foreground">Loading images...</div>
                  ) : images.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No images found.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {images.map((img) => (
                        <div
                          key={img.name}
                          className="bg-slate-900/50 rounded-lg p-3 border border-white/10 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate flex-1" title={img.name}>
                              {img.name}
                            </span>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDelete(img.name)}
                              disabled={deleting === img.name}
                            >
                              {deleting === img.name ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground text-center">Real</div>
                              <div className="aspect-square rounded overflow-hidden bg-black/20 relative">
                                <img
                                  src={img.realUrl}
                                  className="w-full h-full object-cover"
                                  alt="Real"
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).src =
                                      'https://placehold.co/400x400?text=Missing'
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground text-center">AI</div>
                              <div className="aspect-square rounded overflow-hidden bg-black/20 relative">
                                <img
                                  src={img.aiUrl}
                                  className="w-full h-full object-cover"
                                  alt="AI"
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).src =
                                      'https://placehold.co/400x400?text=Missing'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </GameLayout>
  )
}

export default AdminView
