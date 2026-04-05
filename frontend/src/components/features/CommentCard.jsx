// src/components/features/CommentCard.jsx
import { ThumbsUp, Clock, Send, Sparkles, Check, X, Flag } from 'lucide-react'
import { SentimentBadge } from '../ui/Badge'
import { timeAgo, truncate } from '../../utils/formatters'

export const CommentCard = ({
  comment,
  selected = false,
  onSelect,
  onGenerateReply,
  onPostReply,
  onUpdateStatus,
  generating = false,
  posting = false,
  expanded = false,
  onExpand,
}) => {
  const sentimentBorder = {
    positive: 'border-l-emerald/50',
    negative: 'border-l-rose/50',
    question: 'border-l-cyan/50',
    neutral: 'border-l-white/10',
    spam: 'border-l-amber/50',
  }

  return (
    <div
      className={`glass rounded-xl transition-all duration-200 overflow-hidden
                  border-l-2 ${sentimentBorder[comment.sentiment?.label] || 'border-l-white/10'}
                  ${selected ? 'border-brand/30 bg-brand/5' : 'hover:border-white/12'}
                  ${comment.status === 'replied' ? 'opacity-60' : ''}`}
    >
      {/* Comment header */}
      <div className="p-3 cursor-pointer" onClick={onExpand}>
        <div className="flex items-start gap-3">
          {/* Select checkbox */}
          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5
                         transition-all cursor-pointer
                         ${selected
                           ? 'bg-brand border-brand'
                           : 'border-white/20 hover:border-brand/50'}`}
            onClick={(e) => { e.stopPropagation(); onSelect?.() }}
          >
            {selected && <Check size={11} className="text-white" />}
          </div>

          {/* Avatar */}
          <img
            src={comment.authorProfileImage || `https://ui-avatars.com/api/?name=${comment.authorName}&background=141422&color=9CA3AF&size=32`}
            alt={comment.authorName}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white truncate">{comment.authorName}</span>
              <SentimentBadge sentiment={comment.sentiment?.label} />
              {comment.status === 'replied' && (
                <span className="text-2xs text-emerald bg-emerald/10 px-1.5 py-0.5 rounded-md">Replied</span>
              )}
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {expanded ? comment.text : truncate(comment.text, 120)}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-2xs text-gray-600 flex items-center gap-1">
                <Clock size={10} /> {timeAgo(comment.publishedAt)}
              </span>
              {comment.likeCount > 0 && (
                <span className="text-2xs text-gray-600 flex items-center gap-1">
                  <ThumbsUp size={10} /> {comment.likeCount}
                </span>
              )}
              <span className="text-2xs text-gray-600 truncate max-w-[120px]">
                {comment.videoTitle}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reply section — only when expanded */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3">

          {/* Existing AI reply */}
          {comment.aiReply?.text && (
            <div className="bg-brand/10 border border-brand/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-brand" />
                <span className="text-2xs font-semibold text-brand">AI Reply</span>
                {comment.aiReply.isEdited && (
                  <span className="text-2xs text-gray-500">(edited)</span>
                )}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-3">
                {comment.aiReply.text}
              </p>
              <div className="flex items-center gap-2">
                {comment.status !== 'replied' && (
                  <button
                    onClick={() => onPostReply?.(comment._id)}
                    disabled={posting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white
                               text-xs rounded-lg hover:bg-brand-light transition-all
                               disabled:opacity-50"
                  >
                    <Send size={12} />
                    {posting ? 'Posting...' : 'Post Reply'}
                  </button>
                )}
                <button
                  onClick={() => onUpdateStatus?.(comment._id, 'ignored')}
                  className="flex items-center gap-1.5 px-3 py-1.5 glass text-gray-400
                             text-xs rounded-lg hover:text-white transition-all"
                >
                  <X size={12} /> Ignore
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {comment.status !== 'replied' && (
            <div className="flex items-center gap-2 flex-wrap">
              {!comment.aiReply?.text && (
                <button
                  onClick={() => onGenerateReply?.(comment._id, 'friendly')}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 glass text-brand
                             text-xs rounded-lg border border-brand/20
                             hover:bg-brand/10 transition-all disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  {generating ? 'Generating...' : 'Generate Reply'}
                </button>
              )}
              <button
                onClick={() => onUpdateStatus?.(comment._id, 'ignored')}
                className="flex items-center gap-1.5 px-3 py-1.5 glass text-gray-500
                           text-xs rounded-lg hover:text-white transition-all"
              >
                <X size={12} /> Ignore
              </button>
              <button
                onClick={() => onUpdateStatus?.(comment._id, 'flagged')}
                className="flex items-center gap-1.5 px-3 py-1.5 glass text-amber
                           text-xs rounded-lg hover:bg-amber/10 transition-all"
              >
                <Flag size={12} /> Flag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
