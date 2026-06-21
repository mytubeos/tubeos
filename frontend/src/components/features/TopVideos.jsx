// src/components/features/TopVideos.jsx
import { ExternalLink, Eye, ThumbsUp, Clock } from 'lucide-react'
import { formatNumber, formatDate, formatDuration, timeAgo } from '../../utils/formatters'
import { Card, CardHeader } from '../ui/Card'

const VideoRow = ({ video, rank }) => {
  const rankColors = {
    1: 'text-amber bg-amber/15',
    2: 'text-gray-300 bg-white/10',
    3: 'text-amber-600 bg-amber-600/15',
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0
                    hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg group">
      {/* Rank */}
      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0
                       text-xs font-bold ${rankColors[rank] || 'text-gray-500 bg-white/5'}`}>
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="w-14 h-9 rounded-lg overflow-hidden bg-base-600 shrink-0">
        {video.thumbnail?.url ? (
          <img
            src={video.thumbnail.url}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Eye size={14} className="text-gray-600" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-tight">
          {video.title}
        </p>
        <p className="text-2xs text-gray-500 mt-0.5">{timeAgo(video.publishedAt)}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
          <Eye size={12} />
          <span>{formatNumber(video.performance?.views)}</span>
        </div>
        <div className="hidden md:flex items-center gap-1 text-xs text-gray-400">
          <ThumbsUp size={12} />
          <span>{formatNumber(video.performance?.likes)}</span>
        </div>

        {/* External link */}
        {video.youtubeVideoId && (
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center
                       text-gray-600 hover:text-brand hover:bg-brand/10
                       transition-all opacity-0 group-hover:opacity-100"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

export const TopVideos = ({ videos = [], loading = false, title = 'Top Videos' }) => (
  <Card>
    <CardHeader title={title} subtitle="By views" icon={Eye} />
    {loading ? (
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="shimmer w-6 h-6 rounded-md" />
            <div className="shimmer w-14 h-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="shimmer h-3.5 w-3/4 rounded" />
              <div className="shimmer h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    ) : videos.length === 0 ? (
      <div className="text-center py-8 text-gray-500 text-sm">
        No published videos yet
      </div>
    ) : (
      <div>
        {videos.map((video, idx) => (
          <VideoRow key={video._id} video={video} rank={idx + 1} />
        ))}
      </div>
    )}
  </Card>
)
