// src/pages/ai/ShortsStudio.jsx
import { useState } from 'react'
import { Zap, Video, RefreshCw, Copy, Check, Scissors } from 'lucide-react'
import { aiApi } from '../../api/ai.api'
import { videoApi } from '../../api/video.api'
import { useChannelStore } from '../../store/channelStore'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

const STYLES = [
  { value: 'educational', label: '📚 Educational', desc: 'Quick tip or fact' },
  { value: 'entertainment', label: '😂 Entertainment', desc: 'Funny or relatable' },
  { value: 'trending', label: '🔥 Trending', desc: 'Trend-jacking format' },
  { value: 'motivation', label: '💪 Motivation', desc: 'Inspiring + punchy' },
]

const DURATIONS = [
  { value: 30, label: '30s' },
  { value: 45, label: '45s' },
  { value: 60, label: '60s' },
]

export const ShortsStudio = () => {
  const { activeChannel } = useChannelStore()
  const { hasPlan } = useAuth()

  const [activeTab, setActiveTab] = useState('script')
  const [topic, setTopic] = useState('')
  const [style, setStyle] = useState('educational')
  const [duration, setDuration] = useState(60)
  const [script, setScript] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Repurpose state
  const [videos, setVideos] = useState([])
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [repurposeIdeas, setRepurposeIdeas] = useState([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [repurposing, setRepurposing] = useState(false)

  const generateScript = async () => {
    if (!topic) { toast.error('Enter a topic'); return }
    setLoading(true)
    try {
      const res = await aiApi.generateShortsScript({ topic, style, duration })
      setScript(res.data.data)
      toast.success('Script generated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate script')
    } finally {
      setLoading(false)
    }
  }

  const copyScript = () => {
    if (!script?.script) return
    navigator.clipboard.writeText(script.script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const loadPublishedVideos = async () => {
    if (!activeChannel?._id) return
    setLoadingVideos(true)
    try {
      const res = await videoApi.getAll({
        status: 'published',
        channelId: activeChannel._id,
        limit: 20,
      })
      setVideos(res.data.data || [])
    } catch {
      toast.error('Failed to load videos')
    } finally {
      setLoadingVideos(false)
    }
  }

  const handleRepurpose = async () => {
    if (!selectedVideo) { toast.error('Select a video first'); return }
    setRepurposing(true)
    try {
      const res = await aiApi.repurposeToShorts(selectedVideo._id)
      setRepurposeIdeas(res.data.data?.shortsIdeas || [])
      toast.success('3 Shorts ideas generated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to repurpose')
    } finally {
      setRepurposing(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex items-center glass rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('script')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${activeTab === 'script' ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Zap size={15} /> Write Script
        </button>
        <button
          onClick={() => { setActiveTab('repurpose'); loadPublishedVideos() }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${activeTab === 'repurpose' ? 'bg-brand text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Scissors size={15} /> Repurpose Video
          {!hasPlan('pro', 'agency') && (
            <Badge variant="amber" size="xs">PRO</Badge>
          )}
        </button>
      </div>

      {activeTab === 'script' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Input */}
          <Card>
            <CardHeader title="Shorts Script Generator" subtitle="60-second scripts that hook viewers" icon={Zap} />
            <div className="space-y-4">
              <Input
                label="Video Topic"
                placeholder="e.g. 3 ways to get 1000 subscribers fast"
                value={topic}
                onChange={e => setTopic(e.target.value)}
              />

              {/* Style selector */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`p-3 rounded-xl text-left transition-all
                                  ${style === s.value
                                    ? 'bg-brand/15 border border-brand/30'
                                    : 'glass hover:border-white/15'}`}
                    >
                      <p className="text-sm font-medium text-white">{s.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Duration</label>
                <div className="flex items-center glass rounded-xl p-1 w-fit">
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
                                  ${duration === d.value
                                    ? 'bg-brand text-white'
                                    : 'text-gray-400 hover:text-white'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button fullWidth icon={Zap} loading={loading} onClick={generateScript}>
                Generate Script
              </Button>
            </div>
          </Card>

          {/* Script output */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardHeader title="Your Script" icon={Video} />
              {script && (
                <button onClick={copyScript}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand transition-colors">
                  {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy Script'}
                </button>
              )}
            </div>

            {!script ? (
              <div className="text-center py-12 text-gray-500">
                <Zap size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Generate a script to see it here</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="cyan" size="sm">⏱ {script.estimatedDuration}s</Badge>
                  <Badge variant="brand" size="sm">📝 {script.wordCount} words</Badge>
                  <Badge variant="gray" size="sm">🎨 {script.style}</Badge>
                </div>

                <div className="p-4 bg-base-600 rounded-xl border border-white/8">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-body leading-relaxed">
                    {script.script}
                  </pre>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  onClick={generateScript}
                  loading={loading}
                  fullWidth
                >
                  Regenerate
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'repurpose' && (
        !hasPlan('pro', 'agency') ? (
          <div className="text-center py-16 glass rounded-2xl">
            <div className="w-16 h-16 bg-amber/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scissors size={28} className="text-amber" />
            </div>
            <h3 className="font-display font-bold text-white text-xl mb-2">PRO Feature</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
              Repurpose your long videos into 3 Shorts ideas automatically. Available on PRO plan and above.
            </p>
            <Button onClick={() => window.location.href = '/settings'}>
              Upgrade to PRO
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Repurpose Long Video" subtitle="Extract 3 Shorts from any video" icon={Scissors} />

              {loadingVideos ? (
                <div className="space-y-2">
                  {Array(4).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
                </div>
              ) : videos.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No published videos found</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {videos.map(v => (
                    <button
                      key={v._id}
                      onClick={() => setSelectedVideo(v)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                                  ${selectedVideo?._id === v._id
                                    ? 'bg-brand/15 border border-brand/30'
                                    : 'glass hover:border-white/15'}`}
                    >
                      <div className="w-14 h-9 rounded-lg overflow-hidden bg-base-600 shrink-0">
                        {v.thumbnail?.url
                          ? <img src={v.thumbnail.url} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full bg-brand/20" />}
                      </div>
                      <p className="text-sm text-white truncate">{v.title}</p>
                    </button>
                  ))}
                </div>
              )}

              <Button
                fullWidth
                icon={Scissors}
                loading={repurposing}
                disabled={!selectedVideo}
                onClick={handleRepurpose}
                className="mt-4"
              >
                Generate 3 Shorts Ideas
              </Button>
            </Card>

            <div className="space-y-3">
              {repurposeIdeas.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Scissors size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a video and generate Shorts ideas</p>
                </div>
              ) : (
                repurposeIdeas.map((idea, i) => (
                  <Card key={i}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand/15 text-brand text-sm
                                        flex items-center justify-center font-bold">
                          {i + 1}
                        </div>
                        <p className="text-sm font-semibold text-white">{idea.title}</p>
                      </div>
                    </div>
                    {idea.timestampHint && (
                      <p className="text-xs text-cyan mb-2">⏱ {idea.timestampHint}</p>
                    )}
                    <p className="text-xs text-gray-500 mb-3">{idea.whyItWorks}</p>
                    <div className="p-3 bg-base-600 rounded-xl">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-body leading-relaxed">
                        {idea.script}
                      </pre>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
