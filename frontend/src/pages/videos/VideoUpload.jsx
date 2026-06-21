// src/pages/videos/VideoUpload.jsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Sparkles, X, ArrowLeft, Image, Tag, Clock } from 'lucide-react'
import { videoApi } from '../../api/video.api'
import { aiApi } from '../../api/ai.api'
import { useChannelStore } from '../../store/channelStore'
import { Input, Textarea, Select } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { BestTimeWidget } from '../../components/features/BestTimeWidget'
import { VIDEO_CATEGORIES } from '../../utils/constants'
import { formatFileSize } from '../../utils/formatters'
import toast from 'react-hot-toast'

const PRIVACY_OPTIONS = [
  { value: 'private', label: '🔒 Private' },
  { value: 'unlisted', label: '🔗 Unlisted' },
  { value: 'public', label: '🌍 Public' },
]

const CATEGORY_OPTIONS = Object.entries(VIDEO_CATEGORIES).map(([value, label]) => ({ value, label }))

export const VideoUpload = () => {
  const navigate = useNavigate()
  const { activeChannel } = useChannelStore()
  const fileRef = useRef()
  const thumbRef = useRef()

  const [file, setFile] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    tags: '',
    category: '22',
    privacy: 'private',
    scheduledAt: '',
    isShort: false,
  })
  const [thumbnail, setThumbnail] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [savingDraft, setSavingDraft] = useState(false)
  const [generatingAI, setGeneratingAI] = useState({ title: false, tags: false, desc: false })
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (!f.type.startsWith('video/')) { toast.error('Please select a video file'); return }
    if (f.size > 2 * 1024 * 1024 * 1024) { toast.error('File too large (max 2GB)'); return }
    setFile(f)
    // Auto-set title from filename
    if (!form.title) {
      setForm(p => ({ ...p, title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') }))
    }
  }

  const handleThumbnail = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setThumbnail(f)
    setThumbnailPreview(URL.createObjectURL(f))
  }

  const generateTitles = async () => {
    if (!form.title && !form.description) {
      toast.error('Enter a topic or description first')
      return
    }
    setGeneratingAI(p => ({ ...p, title: true }))
    try {
      const res = await aiApi.generateTitles({
        topic: form.title || form.description,
        count: 5,
      })
      const titles = res.data.data?.titles || []
      if (titles.length) {
        setForm(p => ({ ...p, title: titles[0] }))
        toast.success(`${titles.length} titles generated! Using best one.`)
      }
    } catch {
      toast.error('Failed to generate titles')
    } finally {
      setGeneratingAI(p => ({ ...p, title: false }))
    }
  }

  const generateTags = async () => {
    if (!form.title) { toast.error('Enter a title first'); return }
    setGeneratingAI(p => ({ ...p, tags: true }))
    try {
      const res = await aiApi.generateTags({ title: form.title, description: form.description })
      const tags = res.data.data?.tags || []
      setForm(p => ({ ...p, tags: tags.join(', ') }))
      toast.success(`${tags.length} tags generated!`)
    } catch {
      toast.error('Failed to generate tags')
    } finally {
      setGeneratingAI(p => ({ ...p, tags: false }))
    }
  }

  const generateDesc = async () => {
    if (!form.title) { toast.error('Enter a title first'); return }
    setGeneratingAI(p => ({ ...p, desc: true }))
    try {
      const res = await aiApi.generateDescription({
        title: form.title,
        tags: form.tags.split(',').map(t => t.trim()),
      })
      setForm(p => ({ ...p, description: res.data.data?.description || '' }))
      toast.success('Description generated!')
    } catch {
      toast.error('Failed to generate description')
    } finally {
      setGeneratingAI(p => ({ ...p, desc: false }))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!activeChannel?._id) errs.channel = 'No channel connected'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const saveDraft = async () => {
    if (!validate()) return
    setSavingDraft(true)
    try {
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      await videoApi.createDraft({
        channelId: activeChannel._id,
        title: form.title,
        description: form.description,
        tags,
        category: form.category,
        privacy: form.privacy,
        isShort: form.isShort,
      })
      toast.success('Draft saved!')
      navigate('/videos')
    } catch {
      toast.error('Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleUpload = async () => {
    if (!validate()) return
    if (!file) { toast.error('Please select a video file'); return }

    setUploading(true)
    setUploadProgress(10)

    try {
      // 1. Create draft first
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const draftRes = await videoApi.createDraft({
        channelId: activeChannel._id,
        title: form.title,
        description: form.description,
        tags,
        category: form.category,
        privacy: form.privacy,
        scheduledAt: form.scheduledAt || null,
        isShort: form.isShort,
      })
      const videoId = draftRes.data.data?._id
      setUploadProgress(30)

      // 2. Upload file
      const formData = new FormData()
      formData.append('video', file)
      if (thumbnail) formData.append('thumbnail', thumbnail)

      await videoApi.upload(videoId, formData)
      setUploadProgress(100)

      toast.success(form.scheduledAt ? 'Video scheduled!' : 'Video uploaded to YouTube!')
      navigate('/videos')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Back */}
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/videos')}>
        Back to Videos
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Form */}
        <div className="lg:col-span-2 space-y-5">

          {/* File drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                         transition-all duration-200
                         ${file
                           ? 'border-brand/40 bg-brand/5'
                           : 'border-white/15 hover:border-brand/40 hover:bg-brand/5'}`}
          >
            <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
            {file ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 bg-brand/15 rounded-xl flex items-center justify-center">
                  <Upload size={22} className="text-brand" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center
                             text-gray-500 hover:text-rose hover:bg-rose/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={26} className="text-brand" />
                </div>
                <p className="text-white font-medium mb-1">Drag & drop or click to upload</p>
                <p className="text-sm text-gray-500">MP4, MOV, AVI up to 2GB</p>
              </>
            )}
          </div>

          {/* Upload progress */}
          {uploading && uploadProgress > 0 && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Uploading to YouTube...</span>
                <span className="text-brand font-medium">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gradient rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">Title *</label>
              <button
                onClick={generateTitles}
                disabled={generatingAI.title}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light transition-colors"
              >
                <Sparkles size={12} />
                {generatingAI.title ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <input
              value={form.title}
              onChange={set('title')}
              placeholder="Your video title (max 100 chars)"
              maxLength={100}
              className={`input-field ${errors.title ? 'border-rose/50' : ''}`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.title && <p className="text-rose text-xs">{errors.title}</p>}
              <p className="text-2xs text-gray-600 ml-auto">{form.title.length}/100</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <button
                onClick={generateDesc}
                disabled={generatingAI.desc}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light transition-colors"
              >
                <Sparkles size={12} />
                {generatingAI.desc ? 'Generating...' : 'AI Write'}
              </button>
            </div>
            <Textarea
              name="description"
              value={form.description}
              onChange={set('description')}
              placeholder="Describe your video..."
              rows={4}
            />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">
                Tags
                <span className="text-gray-600 font-normal ml-1">(comma separated)</span>
              </label>
              <button
                onClick={generateTags}
                disabled={generatingAI.tags}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light transition-colors"
              >
                <Tag size={12} />
                {generatingAI.tags ? 'Generating...' : 'AI Tags'}
              </button>
            </div>
            <input
              value={form.tags}
              onChange={set('tags')}
              placeholder="tag1, tag2, tag3..."
              className="input-field"
            />
          </div>

          {/* Category + Privacy */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              name="category"
              value={form.category}
              onChange={set('category')}
              options={CATEGORY_OPTIONS}
            />
            <Select
              label="Privacy"
              name="privacy"
              value={form.privacy}
              onChange={set('privacy')}
              options={PRIVACY_OPTIONS}
            />
          </div>

          {/* Thumbnail */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Custom Thumbnail</label>
            <div
              onClick={() => thumbRef.current?.click()}
              className="flex items-center gap-4 p-3 glass rounded-xl cursor-pointer
                         hover:border-white/15 transition-all"
            >
              <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnail} />
              {thumbnailPreview ? (
                <>
                  <img src={thumbnailPreview} className="w-20 h-12 rounded-lg object-cover" alt="" />
                  <div>
                    <p className="text-sm text-white">{thumbnail?.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(thumbnail?.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setThumbnail(null); setThumbnailPreview(null) }}
                    className="ml-auto text-gray-500 hover:text-rose"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                    <Image size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Click to upload thumbnail</p>
                    <p className="text-xs text-gray-600">JPG, PNG recommended 1280×720</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right — Scheduling */}
        <div className="space-y-4">

          {/* Publish options */}
          <div className="glass p-4 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-white">Publish Options</p>

            {/* Schedule toggle */}
            <div>
              <label className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <Clock size={12} /> Schedule for later
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={set('scheduledAt')}
                className="input-field text-sm"
                min={new Date().toISOString().slice(0, 16)}
              />
              {form.scheduledAt && (
                <button
                  onClick={() => setForm(p => ({ ...p, scheduledAt: '' }))}
                  className="text-2xs text-gray-500 hover:text-rose mt-1 transition-colors"
                >
                  Clear (publish now)
                </button>
              )}
            </div>

            {/* Shorts toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">YouTube Short</p>
                <p className="text-xs text-gray-600">Under 60 seconds</p>
              </div>
              <button
                onClick={() => setForm(p => ({ ...p, isShort: !p.isShort }))}
                className={`w-10 h-6 rounded-full transition-all relative
                            ${form.isShort ? 'bg-brand' : 'bg-white/10'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                                  ${form.isShort ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Best time widget */}
          <BestTimeWidget onSelectTime={(time) => {
            setForm(p => ({ ...p, scheduledAt: new Date(time).toISOString().slice(0, 16) }))
            toast.success('Best time auto-filled!')
          }} />

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              fullWidth
              onClick={handleUpload}
              loading={uploading}
              disabled={!file}
            >
              {form.scheduledAt ? '📅 Schedule Upload' : '🚀 Upload Now'}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={saveDraft}
              loading={savingDraft}
            >
              Save as Draft
            </Button>
          </div>

          <p className="text-2xs text-gray-600 text-center">
            Videos are uploaded directly to YouTube via API
          </p>
        </div>
      </div>
    </div>
  )
}
