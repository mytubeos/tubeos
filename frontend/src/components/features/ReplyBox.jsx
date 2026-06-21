// src/components/features/ReplyBox.jsx
import { useState } from 'react'
import { Sparkles, Send, RefreshCw } from 'lucide-react'
import { aiApi } from '../../api/ai.api'
import { REPLY_TONES } from '../../utils/constants'
import toast from 'react-hot-toast'

export const ReplyBox = ({ commentId, commentText, onReplied }) => {
  const [replyText, setReplyText] = useState('')
  const [tone, setTone] = useState('friendly')
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await aiApi.generateReply(commentId, tone)
      const aiText = res.data.data?.aiReply?.text || ''
      setReplyText(aiText)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate reply')
    } finally {
      setGenerating(false)
    }
  }

  const post = async () => {
    if (!replyText.trim()) { toast.error('Reply text is empty'); return }
    setPosting(true)
    try {
      await aiApi.postReply(commentId, replyText)
      toast.success('Reply posted to YouTube!')
      setReplyText('')
      onReplied?.()
    } catch {
      toast.error('Failed to post reply')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="bg-base-600 rounded-xl p-4 space-y-3 border border-white/8">
      {/* Tone selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">Tone:</span>
        {REPLY_TONES.map(t => (
          <button
            key={t.value}
            onClick={() => setTone(t.value)}
            className={`px-2.5 py-1 rounded-lg text-xs transition-all
                        ${tone === t.value
                          ? 'bg-brand text-white'
                          : 'glass text-gray-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Text area */}
      <textarea
        value={replyText}
        onChange={e => setReplyText(e.target.value)}
        placeholder="Write a reply or click Generate AI Reply..."
        rows={3}
        className="input-field resize-none text-sm"
      />

      {/* Character count */}
      <div className="flex items-center justify-between">
        <span className={`text-2xs ${replyText.length > 500 ? 'text-rose' : 'text-gray-600'}`}>
          {replyText.length}/500
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 glass text-brand
                       text-xs rounded-lg border border-brand/20
                       hover:bg-brand/10 transition-all disabled:opacity-50"
          >
            {generating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {generating ? 'Generating...' : 'AI Reply'}
          </button>

          <button
            onClick={post}
            disabled={posting || !replyText.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand text-white
                       text-xs rounded-lg hover:bg-brand-light transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {posting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
