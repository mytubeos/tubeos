// src/components/features/CompetitorCard.jsx
import { TrendingUp, TrendingDown, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
import { formatNumber, timeAgo } from '../../utils/formatters'

export const CompetitorCard = ({ competitor, onSync, onRemove, syncing = false }) => {
  const subGrowth = competitor.history?.length >= 2
    ? competitor.stats.subscribers - competitor.history[competitor.history.length - 2]?.subscribers
    : null

  const isGrowing = subGrowth > 0

  return (
    <div className="glass rounded-xl p-4 hover:border-white/12 transition-all group">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <img
          src={competitor.thumbnail || `https://ui-avatars.com/api/?name=${competitor.channelName}&background=141422&color=9CA3AF`}
          alt={competitor.channelName}
          className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10 shrink-0"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{competitor.channelName}</p>
              {competitor.channelHandle && (
                <p className="text-2xs text-gray-500">{competitor.channelHandle}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onSync?.(competitor._id)}
                disabled={syncing}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-gray-500 hover:text-brand hover:bg-brand/10 transition-all"
              >
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              </button>
              <a
                href={`https://youtube.com/channel/${competitor.youtubeChannelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-gray-500 hover:text-cyan hover:bg-cyan/10 transition-all"
              >
                <ExternalLink size={13} />
              </a>
              <button
                onClick={() => onRemove?.(competitor._id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-gray-500 hover:text-rose hover:bg-rose/10 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <p className="text-xs font-bold text-white">{formatNumber(competitor.stats?.subscribers)}</p>
              <p className="text-2xs text-gray-500">Subscribers</p>
              {subGrowth !== null && (
                <div className={`flex items-center gap-0.5 text-2xs ${isGrowing ? 'text-emerald' : 'text-rose'}`}>
                  {isGrowing ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {isGrowing ? '+' : ''}{formatNumber(subGrowth)}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{formatNumber(competitor.stats?.videoCount)}</p>
              <p className="text-2xs text-gray-500">Videos</p>
            </div>
            <div>
              <p className="text-xs font-bold text-white">{formatNumber(competitor.stats?.totalViews)}</p>
              <p className="text-2xs text-gray-500">Total Views</p>
            </div>
          </div>

          {/* Last synced */}
          {competitor.stats?.lastSyncedAt && (
            <p className="text-2xs text-gray-600 mt-2">
              Synced {timeAgo(competitor.stats.lastSyncedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
