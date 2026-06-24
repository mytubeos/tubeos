import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Youtube, RefreshCw, Trash2, Plus, WifiOff, Star, Zap } from 'lucide-react'
import { useChannel } from '../../hooks/useChannel'
import { useAuthStore } from '../../store/authStore'

export const Channels = () => {
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const {
    channels,
    isLoading,
    fetchChannels,
    connectYouTube,
    handleOAuthReturn,
    syncChannel,
    disconnectChannel,
    setPrimary,
  } = useChannel()

  useEffect(() => {
    fetchChannels()
    if (searchParams.get('youtube_connected') || searchParams.get('youtube_error')) {
      handleOAuthReturn(searchParams)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const planLimits  = { free: 1, creator: 1, pro: 3, agency: 25 }
  const channelLimit = planLimits[user?.plan] || 1
  const canAdd       = channels.length < channelLimit

  return (
    <div className="p-5 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold text-white">YouTube Channels</h1>
          <p className="text-[11px] text-white/35 mt-0.5">
            {channels.length} / {channelLimit} channels connected
            {user?.plan && (
              <span className="ml-1 capitalize text-indigo-400">({user.plan} plan)</span>
            )}
          </p>
        </div>
        <button
          onClick={connectYouTube}
          disabled={!canAdd || isLoading}
          className="flex items-center gap-1.5 px-3.5 py-[7px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-medium rounded-lg transition-colors"
        >
          <Plus size={13} />
          Connect Channel
        </button>
      </div>

      {/* ── Plan limit banner ── */}
      {!canAdd && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] text-amber-400">
            <span className="font-medium">Channel limit reached.</span>{' '}
            Your {user?.plan} plan allows {channelLimit} channel(s).{' '}
            <a href="/pricing" className="underline hover:text-amber-300">Upgrade →</a>
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && channels.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && channels.length === 0 && (
        <div className="rounded-xl border border-white/7 bg-white/[0.03] px-6 py-10 text-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-3">
            <Youtube size={22} className="text-white/20" />
          </div>
          <p className="text-[13px] font-medium text-white mb-1">No channels connected</p>
          <p className="text-[11px] text-white/35 mb-5 leading-relaxed">
            Connect your YouTube channel to start managing your content.
          </p>
          <button
            onClick={connectYouTube}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus size={13} />
            Connect YouTube Channel
          </button>
        </div>
      )}

      {/* ── Channel cards ── */}
      {channels.length > 0 && (
        <div className="space-y-2 mb-4">
          {channels.map((ch) => (
            <ChannelCard
              key={ch._id}
              channel={ch}
              onSync={() => syncChannel(ch._id)}
              onDisconnect={() => {
                if (window.confirm(`Disconnect "${ch.channelName}"?`)) disconnectChannel(ch._id)
              }}
              onSetPrimary={() => setPrimary(ch._id)}
              onReconnect={connectYouTube}
            />
          ))}
        </div>
      )}

      {/* ── How it works ── */}
      <div className="rounded-xl border border-white/7 bg-white/[0.02] px-4 py-3">
        <p className="text-[11px] text-white/30 leading-relaxed">
          <span className="text-white/50 font-medium">How it works: </span>
          Clicking "Connect Channel" opens a Google OAuth popup. After you grant access,
          the popup closes and your channel appears here automatically.
          Your credentials are stored securely and never shared.
        </p>
      </div>
    </div>
  )
}

/* ── Single channel card ── */
function ChannelCard({ channel, onSync, onDisconnect, onSetPrimary, onReconnect }) {
  const isConnected = channel.connectionStatus === 'connected'
  const needsReconnect = channel.connectionStatus === 'token_expired' || channel.connectionStatus === 'reconnect_required'

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/7 bg-white/[0.03] hover:bg-white/[0.045] transition-colors">

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {channel.thumbnail ? (
          <img
            src={channel.thumbnail}
            alt={channel.channelName}
            className="w-11 h-11 rounded-full object-cover"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-lg">
            🎥
          </div>
        )}
        {/* Status dot */}
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f0f14] ${
          isConnected ? 'bg-emerald-400' : 'bg-amber-400'
        }`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-[13px] font-medium text-white truncate">{channel.channelName}</span>

          {channel.isPrimary && (
            <span className="px-[7px] py-[2px] rounded-full text-[10px] bg-indigo-500/12 text-indigo-400 border border-indigo-500/25">
              Primary
            </span>
          )}

          <span className={`px-[7px] py-[2px] rounded-full text-[10px] border ${
            isConnected
              ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {isConnected ? 'Connected' : needsReconnect ? 'Reconnect needed' : channel.connectionStatus}
          </span>
        </div>

        {channel.channelHandle && (
          <p className="text-[11px] text-white/35 mb-1">
            @{channel.channelHandle.replace('@', '')}
          </p>
        )}

        <div className="flex gap-3">
          <span className="text-[10px] text-white/35">
            {Number(channel.stats?.subscriberCount || 0).toLocaleString()} subscribers
          </span>
          <span className="text-[10px] text-white/35">
            {Number(channel.stats?.videoCount || 0).toLocaleString()} videos
          </span>
          <span className="text-[10px] text-white/35">
            {Number(channel.stats?.viewCount || 0).toLocaleString()} views
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {needsReconnect && (
          <button
            onClick={onReconnect}
            title="Reconnect"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-400 text-[10px] hover:bg-amber-500/15 transition-colors"
          >
            <WifiOff size={11} />
            Reconnect
          </button>
        )}

        {!channel.isPrimary && (
          <ActionBtn onClick={onSetPrimary} title="Set as primary">
            <Star size={13} />
          </ActionBtn>
        )}

        <ActionBtn onClick={onSync} title="Sync stats">
          <RefreshCw size={13} />
        </ActionBtn>

        <ActionBtn onClick={onDisconnect} title="Disconnect" danger>
          <Trash2 size={13} />
        </ActionBtn>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 rounded-lg border border-white/10 bg-transparent flex items-center justify-center transition-colors ${
        danger
          ? 'text-white/30 hover:text-rose-400 hover:border-rose-500/30'
          : 'text-white/30 hover:text-white/70 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}
