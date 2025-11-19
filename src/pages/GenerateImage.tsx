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
      const response = await fetch(
        'https://n8n.srv1131293.hstgr.cloud/webhook/real-vs-ai/generate',
        {
          method: 'POST',
          headers: {
            'real-vs-ai-key': import.meta.env.VITE_API_KEY,
          },
          body: formData,
        },
      )

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
              <ImageIcon className="w-6 h-6 text-indigo-400" />
              Generate Image
            </CardTitle>
            <CardDescription>Upload an image to generate a new variation</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">Name</label>
                <Input
                  type="text"
                  placeholder="Enter a name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-900/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">Image</label>
                <div
                  className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer bg-slate-900/30"
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
                    <div className="text-sm text-indigo-400 font-medium truncate">{file.name}</div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Click to upload image</span>
                    </div>
                  )}
                </div>
              </div>

              {status === 'success' && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm text-center">
                  Successfully submitted!
                  <br />
                  <div>Here is your fancy prompt</div>
                  <div className="p-8 bg-gray-800/50 rounded">{prompt}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(prompt)}
                    className="mt-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-xs"
                  >
                    Copy Prompt
                  </button>
                </div>
              )}

              {status === 'error' && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm text-center">
                  Something went wrong. Please try again.
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="neon"
                size="lg"
                className="w-full"
                type="submit"
                disabled={loading || !file || !name}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
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
