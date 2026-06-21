// src/pages/comments/CommentInbox.jsx
import { useState, useEffect } from 'react'
import { MessageCircle, RefreshCw, Search, Filter, Sparkles, CheckCheck } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { aiApi } from '../../api/ai.api'
import { CommentCard } from '../../components/features/CommentCard'
import { ReplyBox } from '../../components/features/ReplyBox'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { formatNumber } from '../../utils/formatters'
import toast from 'react-hot-toast'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'pending_reply', label: 'Pending' },
  { value: 'replied', label: 'Replied' },
  { value: 'flagged', label: 'Flagged' },
]

const SENTIMENT_FILTERS = [
  { value: '', label: 'All' },
  { value: 'positive', label: '😊 Positive' },
  { value: 'question', label: '❓ Questions' },
  { value: 'negative', label: '😤 Negative' },
  { value: 'neutral', label: '😐 Neutral' },
]

export const CommentInbox = () => {
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const [comments, setComments] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('unread')
  const [sentimentFilter, setSentimentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [generatingId, setGeneratingId] = useState(null)
  const [postingId, setPostingId] = useState(null)
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [replyModal, setReplyModal] = useState(null)

  const fetchComments = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      if (sentimentFilter) params.sentiment = sentimentFilter
      if (search) params.search = search

      const res = await aiApi.getInbox(channelId, params)
      setComments(res.data.data || [])
      setStats(res.data.meta?.stats || {})
      setTotal(res.data.meta?.pagination?.total || 0)
    } catch {
      toast.error('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchComments() }, [channelId, statusFilter, sentimentFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => { if (channelId) fetchComments() }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const handleSync = async () => {
    if (!channelId) return
    setSyncing(true)
    try {
      const res = await aiApi.syncComments(channelId)
      toast.success(res.data.message || 'Comments synced!')
      fetchComments()
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerateReply = async (commentId, tone = 'friendly') => {
    setGeneratingId(commentId)
    try {
      const res = await aiApi.generateReply(commentId, tone)
      setComments(prev =>
        prev.map(c => c._id === commentId ? { ...c, ...res.data.data } : c)
      )
      toast.success('Reply generated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate reply')
    } finally {
      setGeneratingId(null)
    }
  }

  const handlePostReply = async (commentId) => {
    setPostingId(commentId)
    try {
      await aiApi.postReply(commentId)
      setComments(prev =>
        prev.map(c => c._id === commentId ? { ...c, status: 'replied' } : c)
      )
      toast.success('Reply posted!')
    } catch {
      toast.error('Failed to post reply')
    } finally {
      setPostingId(null)
    }
  }

  const handleUpdateStatus = async (commentId, status) => {
    try {
      await aiApi.updateCommentStatus(commentId, status)
      if (statusFilter && status !== statusFilter) {
        setComments(prev => prev.filter(c => c._id !== commentId))
      } else {
        setComments(prev =>
          prev.map(c => c._id === commentId ? { ...c, status } : c)
        )
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleBulkGenerate = async () => {
    if (!selectedIds.length) { toast.error('Select comments first'); return }
    setBulkGenerating(true)
    try {
      await aiApi.bulkGenerateReplies({
        channelId,
        commentIds: selectedIds,
        tone: 'friendly',
      })
      toast.success(`Replies generated for ${selectedIds.length} comments!`)
      setSelectedIds([])
      fetchComments()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk generate failed')
    } finally {
      setBulkGenerating(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <MessageCircle size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to manage comments</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'gray' },
          { label: 'Unread', value: stats.unread, color: 'brand' },
          { label: 'Pending', value: stats.pendingReply, color: 'amber' },
          { label: 'Positive', value: stats.positive, color: 'emerald' },
          { label: 'Negative', value: stats.negative, color: 'rose' },
          { label: 'Questions', value: stats.questions, color: 'cyan' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass p-3 rounded-xl text-center">
            <p className={`font-display font-bold text-lg text-${color}`}>
              {formatNumber(value || 0)}
            </p>
            <p className="text-2xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-48">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search comments..."
              className="input-field pl-9 text-sm h-9"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <Button
            size="sm"
            icon={Sparkles}
            onClick={handleBulkGenerate}
            loading={bulkGenerating}
          >
            Generate {selectedIds.length} Replies
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={handleSync}
          loading={syncing}
        >
          Sync
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center glass rounded-xl p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${statusFilter === f.value
                            ? 'bg-brand text-white'
                            : 'text-gray-400 hover:text-white'}`}
            >
              {f.label}
              {f.value === 'unread' && stats.unread > 0 && (
                <span className="ml-1.5 bg-rose text-white text-2xs px-1 rounded-full">
                  {stats.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center glass rounded-xl p-1">
          {SENTIMENT_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setSentimentFilter(f.value); setPage(1) }}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all
                          ${sentimentFilter === f.value
                            ? 'bg-white/10 text-white'
                            : 'text-gray-500 hover:text-gray-300'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Select all */}
      {comments.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedIds(selectedIds.length === comments.length ? [] : comments.map(c => c._id))}
            className="text-xs text-gray-500 hover:text-brand transition-colors flex items-center gap-1.5"
          >
            <CheckCheck size={14} />
            {selectedIds.length === comments.length ? 'Deselect all' : 'Select all'}
          </button>
          {selectedIds.length > 0 && (
            <span className="text-xs text-brand">{selectedIds.length} selected</span>
          )}
          <span className="text-xs text-gray-600 ml-auto">
            {total} comments
          </span>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="shimmer h-20 rounded-xl" />)}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <MessageCircle size={36} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-3">No comments found</p>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleSync}>
            Sync Comments
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map(comment => (
            <CommentCard
              key={comment._id}
              comment={comment}
              selected={selectedIds.includes(comment._id)}
              onSelect={() => toggleSelect(comment._id)}
              expanded={expandedId === comment._id}
              onExpand={() => setExpandedId(expandedId === comment._id ? null : comment._id)}
              onGenerateReply={handleGenerateReply}
              onPostReply={() => {
                setReplyModal(comment)
                setExpandedId(comment._id)
              }}
              onUpdateStatus={handleUpdateStatus}
              generating={generatingId === comment._id}
              posting={postingId === comment._id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <Button variant="ghost" size="sm" disabled={comments.length < 20} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
