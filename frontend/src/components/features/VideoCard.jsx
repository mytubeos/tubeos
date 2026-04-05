// src/components/features/VideoCard.jsx
import { Eye, ThumbsUp, Clock, ExternalLink, Edit2, Trash2, Calendar, MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '../ui/Badge'
import { formatNumber, formatDate, formatDuration, timeAgo } from '../../utils/formatters'

export const VideoCard = ({ video, onEdit, onDelete, onCancel, compact = false }) => {
  const [showMenu, setShowMenu] = useState(false)
  const navigate = useNavigate()

  const thumb = video.thumbnail?.url

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 glass rounded-xl hover:border-white/12 transition-all">
        <div className="w-16 h-10 rounded-lg overflow-hidden bg-base-600 shrink-0">
          {thumb
            ? <img src={thumb} className="w-full h-full object-cover" alt="" />
            : <div className="w-full h-full bg-brand/20" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{video.title}</p>
          <p className="text-2xs text-gray-500">{formatDate(video.scheduledAt || video.createdAt, 'short')}</p>
        </div>
        <StatusBadge status={video.status} />
      </div>
    )
  }

  return (
    <div className="glass rounded-xl overflow-hidden hover:border-white/12 transition-all group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-base-600 overflow-hidden">
        {thumb
          ? <img src={thumb} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt={video.title} />
          : <div className="w-full h-full bg-gradient-to-br from-brand/20 to-cyan/10 flex items-center justify-center">
              <Eye size={24} className="text-brand/40" />
            </div>
        }
        <div className="absolute top-2 left-2">
          <StatusBadge status={video.status} />
        </div>
        {video.isShort && (
          <div className="absolute top-2 right-2 bg-rose text-white text-2xs font-bold px-1.5 py-0.5 rounded">
            SHORT
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity
                        flex items-center justify-center gap-2">
          {video.youtubeVideoId && (
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center
                         hover:bg-white/30 transition-all"
              onClick={e => e.stopPropagation()}
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
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 rounded-lg flex items-center justify-center
                         text-gray-500 hover:text-white hover:bg-white/8 transition-all"
            >
              <MoreVertical size={15} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 w-40 bg-base-700 border border-white/10
                                rounded-xl shadow-2xl z-20 overflow-hidden">
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(video); setShowMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm
                                 text-gray-300 hover:bg-white/5 hover:text-white transition-all"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                  )}
                  {video.status === 'scheduled' && onCancel && (
                    <button
                      onClick={() => { onCancel(video._id); setShowMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm
                                 text-amber hover:bg-amber/5 transition-all"
                    >
                      <Calendar size={14} /> Cancel Schedule
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { onDelete(video._id); setShowMenu(false) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm
                                 text-rose hover:bg-rose/5 transition-all"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-2xs text-gray-500">
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
            {video.scheduledAt ? formatDate(video.scheduledAt, 'datetime') : timeAgo(video.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
