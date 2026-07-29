// src/components/features/BulkReplyReviewModal.jsx
// "Review then post all" — shows every drafted (pending_reply) AI reply for a
// channel, lets the user edit or skip each one, then posts the approved set
// to YouTube in a single action.
import { useState, useEffect } from 'react'
import { Sparkles, Send, X as XIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { aiApi } from '../../api/ai.api'
import { truncate } from '../../utils/formatters'
import toast from 'react-hot-toast'

export const BulkReplyReviewModal = ({ isOpen, onClose, channelId, onDone }) => {
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState([])
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!isOpen || !channelId) return
    setLoading(true)
    aiApi
      .getInbox(channelId, { status: 'pending_reply', limit: 50 })
      .then((res) => {
        const comments = (res.data.data || []).filter((c) => c.aiReply?.text)
        setDrafts(
          comments.map((c) => ({
            commentId: c._id,
            authorName: c.authorName,
            originalText: c.text,
            replyText: c.aiReply.text,
            skip: false,
          }))
        )
      })
      .catch(() => toast.error('Failed to load pending replies'))
      .finally(() => setLoading(false))
  }, [isOpen, channelId])

  const updateReplyText = (commentId, text) => {
    setDrafts((prev) =>
      prev.map((d) => (d.commentId === commentId ? { ...d, replyText: text } : d))
    )
  }

  const toggleSkip = (commentId) => {
    setDrafts((prev) => prev.map((d) => (d.commentId === commentId ? { ...d, skip: !d.skip } : d)))
  }

  const approvedCount = drafts.filter((d) => !d.skip).length

  const handleApproveAndPost = async () => {
    const toPost = drafts.filter((d) => !d.skip && d.replyText.trim())
    if (!toPost.length) {
      toast.error('Nothing to post — everything is skipped or empty')
      return
    }
    setPosting(true)
    try {
      const res = await aiApi.bulkPostReplies(
        toPost.map((d) => ({ commentId: d.commentId, replyText: d.replyText.trim() }))
      )
      const { successful, failed } = res.data.data.summary
      if (failed === 0) {
        toast.success(`${successful} replies posted to YouTube!`)
      } else {
        toast.error(`${successful} posted, ${failed} failed — check the comment list for details`)
      }
      onDone?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post replies')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review & Post Replies"
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            icon={Send}
            onClick={handleApproveAndPost}
            loading={posting}
            disabled={loading || approvedCount === 0}
          >
            Approve & Post All ({approvedCount})
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="shimmer h-28 rounded-xl" />
            ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Sparkles size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No pending replies to review right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div
              key={d.commentId}
              className={`rounded-xl border p-3 transition-all ${
                d.skip ? 'opacity-40 border-white/8' : 'border-brand/20 bg-brand/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">{d.authorName}</p>
                  <p className="text-xs text-gray-500 truncate">{truncate(d.originalText, 100)}</p>
                </div>
                <button
                  onClick={() => toggleSkip(d.commentId)}
                  className="flex items-center gap-1 text-2xs text-gray-500 hover:text-white shrink-0"
                >
                  <XIcon size={11} />
                  {d.skip ? 'Skipped — undo' : 'Skip'}
                </button>
              </div>
              <textarea
                value={d.replyText}
                onChange={(e) => updateReplyText(d.commentId, e.target.value)}
                disabled={d.skip}
                rows={2}
                className="w-full bg-base-600 border border-white/10 rounded-lg px-3 py-2
                           text-sm text-gray-200 resize-none focus:outline-none
                           focus:border-brand/40 disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
