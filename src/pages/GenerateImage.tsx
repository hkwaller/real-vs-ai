import React, { useState, useRef } from 'react'
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
import { Loader2, Upload, Send, Image as ImageIcon } from 'lucide-react'

const GenerateImage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [prompt, setPrompt] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name) return

    setLoading(true)
    setStatus('idle')

    const formData = new FormData()
    formData.append('name', name)
    formData.append('image', file)

    try {
      const response = await fetch(import.meta.env.VITE_N8N_API_URL as string, {
        method: 'POST',
        headers: { 'real-vs-ai-key': import.meta.env.VITE_API_KEY },
        body: formData,
      })

      if (response.ok) {
        console.log(response)
        setStatus('success')
        const data = await response.json()
        console.log(data)
        setPrompt(data.prompt)
        setName('')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setStatus('error')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-ink" strokeWidth={2.5} />
              Generate Image
            </CardTitle>
            <CardDescription>Upload an image to generate a new variation</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="type-label text-sm flex items-center gap-2">Name</label>
                <Input
                  type="text"
                  placeholder="Enter a name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="type-label text-sm flex items-center gap-2">Image</label>
                <div
                  className="border-4 border-dashed border-ink p-6 text-center hover:border-side-b transition-colors cursor-pointer bg-paper"
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
                    <div className="text-sm text-ink font-semibold truncate">{file.name}</div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <Upload className="w-8 h-8" strokeWidth={2.5} />
                      <span className="text-sm font-medium">Click to upload image</span>
                    </div>
                  )}
                </div>
              </div>

              {status === 'success' && (
                <div className="p-3 border-4 border-ink text-ink text-sm font-medium text-center space-y-2">
                  Successfully submitted!
                  <br />
                  <div>Here is your fancy prompt</div>
                  <div className="p-4 bg-muted text-left break-words">{prompt}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(prompt)}
                    className="mt-2 px-3 py-2 bg-side-b text-paper type-label text-xs hover:brightness-[0.92] transition-[filter] cursor-pointer"
                  >
                    Copy Prompt
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div className="p-3 bg-ink text-paper text-sm font-medium text-center">
                  Something went wrong. Please try again.
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="default"
                size="lg"
                className="w-full"
                type="submit"
                disabled={loading || !file || !name}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send />
                    Submit
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </GameLayout>
  )
}

export default GenerateImage
