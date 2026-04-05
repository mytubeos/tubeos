// src/pages/channels/Channels.jsx
import { useState, useEffect } from 'react'
import { Youtube, Plus, RefreshCw, Star, Trash2, ExternalLink, Zap } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useChannel } from '../../hooks/useChannel'
import { useAuthStore } from '../../store/authStore'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge, StatusBadge } from '../../components/ui/Badge'
import { ConfirmModal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import { formatNumber, formatDate } from '../../utils/formatters'
import { PLANS } from '../../utils/constants'

const ChannelCard = ({ channel, onSync, onDisconnect, onSetPrimary, syncing }) => (
  <div className="glass rounded-2xl p-5 hover:border-white/12 transition-all">
    <div className="flex items-start gap-4">
      {/* Avatar */}
      <div className="relative shrink-0">
        <img
          src={channel.thumbnail || `https://ui-avatars.com/api/?name=${channel.channelName}&background=4F46E5&color=fff&size=48`}
          alt={channel.channelName}
          className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white/10"
        />
        {channel.isPrimary && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber rounded-full
                          flex items-center justify-center shadow-lg">
            <Star size={11} className="text-white fill-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="font-display font-semibold text-white text-base leading-tight">
              {channel.channelName}
            </h3>
            {channel.channelHandle && (
              <p className="text-xs text-gray-500">{channel.channelHandle}</p>
            )}
          </div>
          <StatusBadge status={channel.connectionStatus || 'connected'} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
          {[
            { label: 'Subscribers', value: formatNumber(channel.stats?.subscriberCount) },
            { label: 'Videos', value: formatNumber(channel.stats?.videoCount) },
            { label: 'Total Views', value: formatNumber(channel.stats?.viewCount) },
          ].map(({ label, value }) => (
            <div key={label} className="glass p-2.5 rounded-xl text-center">
              <p className="font-display font-bold text-white text-sm">{value}</p>
              <p className="text-2xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quota */}
        {channel.quota && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-2xs text-gray-500 mb-1">
              <span>API Quota</span>
              <span>{channel.quota.dailyUsed || 0}/{channel.quota.dailyLimit || 10000}/day</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  ((channel.quota.dailyUsed / channel.quota.dailyLimit) * 100) > 80
                    ? 'bg-rose'
                    : 'bg-brand'
                }`}
                style={{ width: `${Math.min(100, ((channel.quota.dailyUsed || 0) / (channel.quota.dailyLimit || 10000)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!channel.isPrimary && (
            <Button
              size="xs"
              variant="ghost"
              icon={Star}
              onClick={() => onSetPrimary(channel._id)}
            >
              Set Primary
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            icon={RefreshCw}
            onClick={() => onSync(channel._id)}
            loading={syncing}
          >
            Sync
          </Button>
          <a
            href={`https://youtube.com/channel/${channel.channelId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="xs" variant="ghost" icon={ExternalLink}>
              View
            </Button>
          </a>
          <Button
            size="xs"
            variant="danger"
            icon={Trash2}
            onClick={() => onDisconnect(channel._id)}
          >
            Disconnect
          </Button>
        </div>

        {channel.stats?.lastSyncedAt && (
          <p className="text-2xs text-gray-600 mt-2">
            Last synced: {formatDate(channel.stats.lastSyncedAt, 'datetime')}
          </p>
        )}
      </div>
    </div>
  </div>
)

export const Channels = () => {
  const { user } = useAuthStore()
  const {
    channels, isLoading, fetchChannels,
    connectChannel, disconnectChannel,
    syncChannel, setPrimary, isAtLimit,
  } = useChannel()

  const [disconnectId, setDisconnectId] = useState(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncingId, setSyncingId] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  // Handle YouTube OAuth callback result
  useEffect(() => {
    const ytError = searchParams.get('youtube_error')
    const ytConnected = searchParams.get('youtube_connected')
    const channelName = searchParams.get('channel')

    if (ytConnected) {
      toast.success(`✅ ${decodeURIComponent(channelName || 'Channel')} connected!`)
      fetchChannels()
      setSearchParams({}) // Clear URL params
    } else if (ytError) {
      const errorMsg = {
        access_denied: 'You denied YouTube access',
        missing_params: 'OAuth failed — try again',
        invalid_state: 'Session expired — try again',
      }[ytError] || decodeURIComponent(ytError)
      toast.error(`YouTube Error: ${errorMsg}`)
      setSearchParams({}) // Clear URL params
    }
  }, [searchParams, fetchChannels, setSearchParams])

  const planLimit = PLANS[user?.plan]?.channels || 1
  const atLimit = channels.length >= planLimit

  const handleConnect = async () => {
    setConnecting(true)
    await connectChannel()
    setConnecting(false)
  }

  const handleSync = async (id) => {
    setSyncingId(id)
    await syncChannel(id)
    setSyncingId(null)
  }

  const handleDisconnect = async () => {
    if (!disconnectId) return
    setDisconnecting(true)
    await disconnectChannel(disconnectId)
    setDisconnecting(false)
    setDisconnectId(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">
            {channels.length}/{planLimit} channels connected
            {atLimit && (
              <span className="text-amber ml-2">· Limit reached</span>
            )}
          </p>
        </div>
        <Button
          icon={Plus}
          onClick={handleConnect}
          loading={connecting}
          disabled={atLimit}
        >
          Connect Channel
        </Button>
      </div>

      {/* Plan limit bar */}
      <div className="glass p-4 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Youtube size={16} className="text-rose" />
            <span className="text-sm font-medium text-white">Channel Slots</span>
          </div>
          <Badge variant={atLimit ? 'rose' : 'emerald'} size="sm">
            {channels.length}/{planLimit} used
          </Badge>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${atLimit ? 'bg-rose' : 'bg-brand-gradient'}`}
            style={{ width: `${(channels.length / planLimit) * 100}%` }}
          />
        </div>
        {atLimit && (
          <p className="text-xs text-amber mt-2">
            Upgrade to PRO for 3 channels or AGENCY for 25 channels
          </p>
        )}
      </div>

      {/* Channels */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(2).fill(0).map((_, i) => <div key={i} className="shimmer h-52 rounded-2xl" />)}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-rose/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Youtube size={36} className="text-rose" />
          </div>
          <h2 className="font-display font-bold text-white text-2xl mb-3">
            Connect your first channel
          </h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-8">
            Link your YouTube channel via OAuth to start using TubeOS
          </p>
          <Button icon={Plus} size="lg" onClick={handleConnect} loading={connecting}>
            Connect YouTube Channel
          </Button>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Zap size={14} className="text-brand" />
            <p className="text-xs text-gray-500">
              Secure OAuth2 — we never store your password
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map(channel => (
            <ChannelCard
              key={channel._id}
              channel={channel}
              onSync={handleSync}
              onDisconnect={setDisconnectId}
              onSetPrimary={setPrimary}
              syncing={syncingId === channel._id}
            />
          ))}
        </div>
      )}

      {/* Disconnect confirm */}
      <ConfirmModal
        isOpen={!!disconnectId}
        onClose={() => setDisconnectId(null)}
        onConfirm={handleDisconnect}
        title="Disconnect Channel"
        message="This will remove the channel from TubeOS. Your YouTube channel and videos won't be affected."
        confirmLabel="Disconnect"
        confirmVariant="danger"
        loading={disconnecting}
      />
    </div>
  )
}
