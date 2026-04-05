// src/pages/ai/AIContent.jsx
import { useState } from 'react'
import {
  Sparkles, Type, Tag, FileText, Lightbulb,
  Copy, RefreshCw, Check, Image,
} from 'lucide-react'
import { aiApi } from '../../api/ai.api'
import { useChannelStore } from '../../store/channelStore'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import toast from 'react-hot-toast'

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand transition-colors">
      {copied ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

const ResultBox = ({ items = [], type = 'list', onSelect }) => {
  if (!items.length) return null
  if (type === 'text') {
    return (
      <div className="mt-4 p-4 bg-base-600 rounded-xl border border-white/8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium">Generated</span>
          <CopyButton text={items[0]} />
        </div>
        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{items[0]}</p>
      </div>
    )
  }
  return (
    <div className="mt-4 space-y-2">
      {items.map((item, i) => (
        <div key={i}
          className="flex items-center justify-between p-3 glass rounded-xl
                     hover:border-brand/20 transition-all group cursor-pointer"
          onClick={() => onSelect?.(item)}
        >
          <span className="text-sm text-gray-300 flex-1 pr-4">{item}</span>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={item} />
            {onSelect && (
              <button className="text-xs text-brand hover:underline">Use</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const TagCloud = ({ tags = [] }) => (
  <div className="mt-4 flex flex-wrap gap-2">
    {tags.map((tag, i) => (
      <div key={i}
        className="flex items-center gap-1.5 px-2.5 py-1 glass rounded-lg
                   hover:border-brand/25 transition-all cursor-pointer group"
        onClick={() => navigator.clipboard.writeText(tag)}
      >
        <span className="text-xs text-gray-300">{tag}</span>
        <Copy size={10} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    ))}
    <button
      onClick={() => navigator.clipboard.writeText(tags.join(', '))}
      className="px-2.5 py-1 text-xs text-brand border border-brand/20 rounded-lg
                 hover:bg-brand/10 transition-all"
    >
      Copy All
    </button>
  </div>
)

export const AIContent = () => {
  const { activeChannel } = useChannelStore()
  const [activeTab, setActiveTab] = useState('titles')
  const [loading, setLoading] = useState(false)

  // Titles state
  const [titleTopic, setTitleTopic] = useState('')
  const [titles, setTitles] = useState([])

  // Tags state
  const [tagTitle, setTagTitle] = useState('')
  const [tags, setTags] = useState([])

  // Description state
  const [descTitle, setDescTitle] = useState('')
  const [description, setDescription] = useState('')

  // Ideas state
  const [niche, setNiche] = useState('')
  const [ideas, setIdeas] = useState([])

  // Thumbnail state
  const [thumbTopic, setThumbTopic] = useState('')
  const [thumbIdeas, setThumbIdeas] = useState([])

  const TABS = [
    { key: 'titles', label: 'Titles', icon: Type },
    { key: 'tags', label: 'Tags', icon: Tag },
    { key: 'description', label: 'Description', icon: FileText },
    { key: 'ideas', label: 'Content Ideas', icon: Lightbulb },
    { key: 'thumbnail', label: 'Thumbnail Ideas', icon: Image },
  ]

  const handleGenerate = async () => {
    setLoading(true)
    try {
      if (activeTab === 'titles') {
        if (!titleTopic) { toast.error('Enter a topic'); return }
        const res = await aiApi.generateTitles({ topic: titleTopic, count: 6 })
        setTitles(res.data.data?.titles || [])
        toast.success('6 titles generated!')

      } else if (activeTab === 'tags') {
        if (!tagTitle) { toast.error('Enter a title'); return }
        const res = await aiApi.generateTags({ title: tagTitle })
        setTags(res.data.data?.tags || [])
        toast.success(`${res.data.data?.tags?.length} tags generated!`)

      } else if (activeTab === 'description') {
        if (!descTitle) { toast.error('Enter a title'); return }
        const res = await aiApi.generateDescription({ title: descTitle })
        setDescription(res.data.data?.description || '')
        toast.success('Description generated!')

      } else if (activeTab === 'ideas') {
        const res = await aiApi.getContentIdeas({
          channelId: activeChannel?._id,
          niche: niche || 'general',
          count: 10,
        })
        setIdeas(res.data.data?.ideas || [])
        toast.success('10 content ideas generated!')

      } else if (activeTab === 'thumbnail') {
        if (!thumbTopic) { toast.error('Enter a topic'); return }
        const res = await aiApi.generateTitles({
          topic: `thumbnail ideas for: ${thumbTopic}`,
          count: 5,
        })
        // Use thumbnail-specific endpoint if available, else titles endpoint
        setThumbIdeas(res.data.data?.titles || [])
        toast.success('Thumbnail ideas generated!')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Tab selector */}
      <div className="flex items-center glass rounded-xl p-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        whitespace-nowrap transition-all
                        ${activeTab === key
                          ? 'bg-brand text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'}`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left — Input */}
        <Card>
          {activeTab === 'titles' && (
            <>
              <CardHeader title="AI Title Generator" subtitle="High-CTR titles in seconds" icon={Type} />
              <div className="space-y-4">
                <Input
                  label="Video Topic"
                  placeholder="e.g. How to grow YouTube channel in 2026"
                  value={titleTopic}
                  onChange={e => setTitleTopic(e.target.value)}
                />
                <Button fullWidth icon={Sparkles} loading={loading} onClick={handleGenerate}>
                  Generate 6 Titles
                </Button>
                <ResultBox items={titles} type="list" />
              </div>
            </>
          )}

          {activeTab === 'tags' && (
            <>
              <CardHeader title="AI Tag Generator" subtitle="SEO-optimized tags" icon={Tag} />
              <div className="space-y-4">
                <Input
                  label="Video Title"
                  placeholder="Enter your video title"
                  value={tagTitle}
                  onChange={e => setTagTitle(e.target.value)}
                />
                <Button fullWidth icon={Sparkles} loading={loading} onClick={handleGenerate}>
                  Generate Tags
                </Button>
                <TagCloud tags={tags} />
              </div>
            </>
          )}

          {activeTab === 'description' && (
            <>
              <CardHeader title="AI Description Writer" subtitle="SEO-rich description" icon={FileText} />
              <div className="space-y-4">
                <Input
                  label="Video Title"
                  placeholder="Enter your video title"
                  value={descTitle}
                  onChange={e => setDescTitle(e.target.value)}
                />
                <Button fullWidth icon={Sparkles} loading={loading} onClick={handleGenerate}>
                  Write Description
                </Button>
                {description && (
                  <div className="mt-4 p-4 bg-base-600 rounded-xl border border-white/8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">{description.length} chars</span>
                      <CopyButton text={description} />
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {description}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'ideas' && (
            <>
              <CardHeader title="Content Ideas" subtitle="Niche-specific video ideas" icon={Lightbulb} iconColor="amber" />
              <div className="space-y-4">
                <Input
                  label="Your Niche"
                  placeholder="e.g. Tech reviews, Cooking, Finance"
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                />
                <Button fullWidth icon={Sparkles} loading={loading} onClick={handleGenerate}>
                  Generate 10 Ideas
                </Button>
              </div>
            </>
          )}

          {activeTab === 'thumbnail' && (
            <>
              <CardHeader title="Thumbnail Strategy Ideas" subtitle="Text-based visual strategy" icon={Image} iconColor="cyan" />
              <div className="space-y-4">
                <Input
                  label="Video Topic"
                  placeholder="e.g. I tried 30 days of waking up at 5AM"
                  value={thumbTopic}
                  onChange={e => setThumbTopic(e.target.value)}
                />
                <Button fullWidth icon={Sparkles} loading={loading} onClick={handleGenerate}>
                  Generate Ideas
                </Button>
                <div className="p-3 bg-amber/5 border border-amber/15 rounded-xl">
                  <p className="text-xs text-amber font-medium mb-1">What you'll get:</p>
                  <p className="text-xs text-gray-400">
                    Background colors, face placement, text suggestions,
                    emoji recommendations, and CTR psychology tips.
                    No image generation — pure strategy! 🎯
                  </p>
                </div>
                <ResultBox items={thumbIdeas} type="list" />
              </div>
            </>
          )}
        </Card>

        {/* Right — Ideas results */}
        {activeTab === 'ideas' && ideas.length > 0 && (
          <div className="space-y-3">
            {ideas.map((idea, i) => (
              <div key={i} className="glass p-4 rounded-xl hover:border-white/15 transition-all">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-white">{idea.title}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={idea.potential === 'high' ? 'emerald' : idea.potential === 'medium' ? 'amber' : 'gray'}
                      size="xs"
                    >
                      {idea.potential}
                    </Badge>
                    <Badge variant="cyan" size="xs">{idea.format}</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{idea.hook}</p>
              </div>
            ))}
          </div>
        )}

        {/* Right — Tips panel */}
        {activeTab !== 'ideas' && (
          <Card>
            <CardHeader title="Pro Tips" icon={Sparkles} iconColor="amber" />
            <div className="space-y-4">
              {activeTab === 'titles' && [
                { tip: 'Numbers work', desc: '"5 ways to..." gets 3x more clicks than generic titles' },
                { tip: 'Use brackets', desc: '"[2026 Guide]" adds credibility and context' },
                { tip: 'Create curiosity', desc: 'Leave a question unanswered in the title' },
                { tip: 'Keep under 60 chars', desc: 'Longer titles get cut off in search results' },
              ].map(({ tip, desc }) => (
                <div key={tip} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-amber text-2xs font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tip}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}

              {activeTab === 'tags' && [
                { tip: 'Mix broad + specific', desc: 'Broad tags for discovery, specific for relevance' },
                { tip: 'First 3 tags = most important', desc: 'YouTube weighs early tags more heavily' },
                { tip: 'Include your channel name', desc: 'Helps appear in "more from this creator"' },
                { tip: '15-20 tags is optimal', desc: 'More than 30 can look spammy' },
              ].map(({ tip, desc }) => (
                <div key={tip} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-amber text-2xs font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tip}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}

              {activeTab === 'description' && [
                { tip: 'First 2 lines matter most', desc: 'Shown in search results before "Show more"' },
                { tip: 'Include keywords naturally', desc: 'Don\'t stuff — write for humans first' },
                { tip: 'Add timestamps', desc: 'Increases watch time and viewer satisfaction' },
                { tip: '3-5 hashtags at end', desc: 'Helps with discoverability and categorization' },
              ].map(({ tip, desc }) => (
                <div key={tip} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-amber text-2xs font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tip}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}

              {activeTab === 'thumbnail' && [
                { tip: 'High contrast always wins', desc: 'Dark background + bright text = more clicks' },
                { tip: 'Face + emotion = CTR boost', desc: 'Human faces with strong emotions get 30% more clicks' },
                { tip: '3 elements max', desc: 'Background + face + text. More = cluttered' },
                { tip: 'Test with your audience', desc: 'What works for tech ≠ what works for cooking' },
              ].map(({ tip, desc }) => (
                <div key={tip} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-amber text-2xs font-bold">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{tip}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
