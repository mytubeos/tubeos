// src/components/features/ThumbnailGeneratorModal.jsx
import { useState } from 'react'
import Cropper from 'react-easy-crop'
import { Sparkles, Wand2 } from 'lucide-react'
import { aiApi } from '../../api/ai.api'
import { useAuthStore } from '../../store/authStore'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import toast from 'react-hot-toast'

const STYLES = [
  { key: 'bold', label: 'Bold' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'dramatic', label: 'Dramatic' },
]

// Draws the cropped region of `imageSrc` onto an offscreen canvas and
// resolves a File. This is how the AI-generated (Cloudinary-hosted) image
// becomes local bytes that flow through VideoUpload's existing thumbnail
// state/upload path unchanged — no new backend endpoint, no separate
// fetch-as-blob round-trip. Relies on Cloudinary serving images with
// permissive CORS headers (standard for its delivery URLs); if that ever
// isn't true this throws and the caller shows a toast instead of setting a
// broken thumbnail.
const cropToFile = (imageSrc, cropPixels) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = cropPixels.width
      canvas.height = cropPixels.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        img,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      )
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Crop failed'))
          resolve(new File([blob], 'ai-thumbnail.jpg', { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92
      )
    }
    img.onerror = () => reject(new Error('Could not load generated image'))
    img.src = imageSrc
  })

export const ThumbnailGeneratorModal = ({ isOpen, onClose, defaultTitle = '', onCropped }) => {
  const { user } = useAuthStore()
  const canGenerate = ['free', 'creator', 'pro', 'agency'].includes(user?.plan)

  const [title, setTitle] = useState(defaultTitle)
  const [niche, setNiche] = useState('')
  const [style, setStyle] = useState('bold')
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)

  const resetCropState = () => {
    setImageUrl(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
  }

  const handleClose = () => {
    resetCropState()
    onClose()
  }

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast.error('Enter a video title')
      return
    }
    setGenerating(true)
    try {
      const res = await aiApi.generateThumbnail({ title, niche, style })
      setImageUrl(res.data.data?.imageUrl || null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thumbnail generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleUseThumbnail = async () => {
    if (!imageUrl || !croppedAreaPixels) return
    setSaving(true)
    try {
      const file = await cropToFile(imageUrl, croppedAreaPixels)
      onCropped(file)
      toast.success('Thumbnail set!')
      handleClose()
    } catch {
      toast.error('Could not use this image — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Generate Thumbnail with AI"
      size="lg"
      footer={
        imageUrl ? (
          <>
            <Button variant="ghost" onClick={resetCropState}>
              Try Again
            </Button>
            <Button
              icon={Wand2}
              loading={saving}
              disabled={!croppedAreaPixels}
              onClick={handleUseThumbnail}
            >
              Use This Thumbnail
            </Button>
          </>
        ) : null
      }
    >
      {!canGenerate ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 mb-3">
            AI thumbnail generation needs the Creator plan or higher.
          </p>
          <Badge variant="cyan">Upgrade to Creator to unlock</Badge>
        </div>
      ) : !imageUrl ? (
        <div className="space-y-4">
          <Input
            label="Video Title"
            name="thumbnail-generator-title"
            placeholder="e.g. I tried 30 days of waking up at 5AM"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            label="Niche (optional)"
            name="thumbnail-generator-niche"
            placeholder="e.g. Fitness, Tech, Gaming"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-gray-300 mb-1.5 block">Style</label>
            <div className="flex items-center gap-2">
              {STYLES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStyle(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                              ${
                                style === key
                                  ? 'bg-brand text-white'
                                  : 'glass text-gray-400 hover:text-white'
                              }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Button fullWidth icon={Sparkles} loading={generating} onClick={handleGenerate}>
            Generate Thumbnail
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Drag to reposition, scroll/pinch to zoom.</p>
          <div className="relative w-full h-72 bg-black rounded-xl overflow-hidden">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
