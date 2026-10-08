// src/components/features/VideoCard.jsx
import {
  Eye,
  Upload,
  Info,
  ThumbsUp,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  MoreVertical,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { StatusBadge } from '../ui/Badge'
import { formatNumber, formatDate, timeAgo } from '../../utils/formatters'

export const VideoCard = ({
  video,
  onEdit,
  onDelete,
  onCancel,
  onRetry,
  onDetails,
  compact = false,
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()
  const closeMenu = useCallback(() => setShowMenu(false), [])

  const thumb = video.thumbnail?.url

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 glass rounded-xl hover:border-white/12 transition-all">
        <div className="w-16 h-10 rounded-lg overflow-hidden bg-base-600 shrink-0">
          {thumb ? (
            <img src={thumb} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-brand/20" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{video.title}</p>
          <p className="text-2xs text-gray-400">
            {formatDate(video.scheduledAt || video.createdAt, 'short')}
          </p>
        </div>
        <StatusBadge status={video.status} />
      </div>
    )
  }

  return (
    <div className="glass rounded-xl hover:border-white/12 transition-all group">
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-t-xl bg-base-600 overflow-hidden">
        {thumb ? (
          <img
            src={thumb}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            alt={video.title}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand/20 to-cyan/10 flex items-center justify-center">
            <Eye size={24} className="text-brand/40" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={video.status} />
        </div>
        {video.isShort && (
          <div className="absolute top-2 right-2 bg-rose text-white text-2xs font-bold px-1.5 py-0.5 rounded">
            SHORT
          </div>
        )}
        {/* Hover overlay */}
        <div
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity
                        flex items-center justify-center gap-2"
        >
          {video.youtubeVideoId && (
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center
                         hover:bg-white/30 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={15} className="text-white" />
            </a>
          )}
          <button
            onClick={() => navigate(`/analytics/video/${video._id}`)}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center
                       hover:bg-white/30 transition-all"
          >
            <Eye size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 flex-1">
            {video.title}
          </p>

          {/* Menu */}
          <div className="relative shrink-0">
            <button
              aria-label={`Actions for ${video.title}`}
              onClick={() => setShowMenu(!showMenu)}
              aria-haspopup="dialog"
              aria-expanded={showMenu}
              className="w-11 h-11 rounded-lg flex items-center justify-center
                         text-gray-400 hover:text-white hover:bg-white/8 transition-all"
            >
              <MoreVertical size={15} />
            </button>
            {showMenu && (
              <Modal
                isOpen={showMenu}
                onClose={closeMenu}
                title="Video actions"
                size="sm"
                mobileSheet
              >
                <div className="flex items-center gap-3 pb-4 mb-2 border-b border-white/10">
                  {thumb && (
                    <img src={thumb} alt="" className="w-16 h-10 object-cover rounded-lg" />
                  )}
                  <p className="text-sm text-white break-words min-w-0">{video.title}</p>
                </div>
                <div className="space-y-1">
                  {video.youtubeVideoId && (
                    <a
                      className="flex items-center gap-2.5 min-h-12 px-3 text-sm text-gray-300"
                      href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closeMenu}
                    >
                      <ExternalLink size={16} /> Open on YouTube
                    </a>
                  )}
                  <button
                    className="flex items-center gap-2.5 w-full min-h-12 px-3 text-sm text-gray-300"
                    onClick={() => {
                      closeMenu()
                      navigate(`/analytics/video/${video._id}`)
                    }}
                  >
                    <Eye size={16} /> View analytics
                  </button>
                  {onDetails && (
                    <button
                      onClick={() => {
                        onDetails(video)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full min-h-12 rounded-xl px-3 py-3 text-sm text-gray-300 hover:bg-white/5"
                    >
                      <Info size={14} /> View details
                    </button>
                  )}
                  {onRetry && (
                    <button
                      onClick={() => {
                        onRetry(video)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full min-h-12 rounded-xl px-3 py-3 text-sm text-brand hover:bg-white/5"
                    >
                      <Upload size={14} /> {video.status === 'failed' ? 'Re-upload' : 'Upload file'}
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(video)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full min-h-12 rounded-xl px-3 py-3 text-sm
                                 text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                  {video.status === 'scheduled' && onCancel && (
                    <button
                      onClick={() => {
                        onCancel(video._id)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full min-h-12 rounded-xl px-3 py-3 text-sm
                                 text-amber hover:bg-amber/5 transition-all"
                    >
                      <Calendar size={14} /> Cancel Schedule
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(video._id)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2.5 w-full min-h-12 rounded-xl px-3 py-3 text-sm
                                 text-rose border-t border-white/10 mt-2 hover:bg-rose/5 transition-all"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </Modal>
            )}
          </div>
        </div>

        {video.status === 'failed' && (
          <p className="text-xs text-rose mb-2 break-words line-clamp-2">
            {video.lastError?.message || 'Upload failed. Open details or re-upload the file.'}
          </p>
        )}
        {/* Stats row */}
        <div className="flex items-center gap-3 text-2xs text-gray-400">
          {video.performance?.views > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={11} />
              {formatNumber(video.performance.views)}
            </span>
          )}
          {video.performance?.likes > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUp size={11} />
              {formatNumber(video.performance.likes)}
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <Clock size={11} />
            {video.scheduledAt
              ? formatDate(video.scheduledAt, 'datetime')
              : timeAgo(video.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
