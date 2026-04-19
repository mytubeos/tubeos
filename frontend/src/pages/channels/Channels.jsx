// src/pages/channels/Channels.jsx
// YouTube channel management page
//
// FIXES:
// 1. useEffect mein handleOAuthReturn call karo — URL params se success/error handle
// 2. Connect button — connectYouTube hook function use karo
// 3. Loading states sahi jagah

import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Youtube, RefreshCw, Star, Trash2, Plus, Wifi, WifiOff } from 'lucide-react'
import { useChannel } from '../../hooks/useChannel'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'

export const Channels = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    channels,
    isLoading,
    connectYouTube,
    handleOAuthReturn,
    syncChannel,
    disconnectChannel,
    setPrimary,
  } = useChannel()

  // FIX 1: Page load pe URL params check karo
  // Google OAuth callback ke baad yahan redirect hota hai
  // ?youtube_connected=true ya ?youtube_error=... handle karo
  useEffect(() => {
    if (searchParams.get('youtube_connected') || searchParams.get('youtube_error')) {
      handleOAuthReturn(searchParams)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Plan limits
  const planLimits  = { free: 1, creator: 1, pro: 3, agency: 25 }
  const channelLimit = planLimits[user?.plan] || 1
  const canAdd       = channels.length < channelLimit

  const statusColor = {
    connected:         'success',
    token_expired:     'warning',
    reconnect_required: 'danger',
    disconnected:      'default',
  }

  const statusLabel = {
    connected:          'Connected',
    token_expired:      'Token Expired',
    reconnect_required: 'Reconnect Required',
    disconnected:       'Disconnected',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">YouTube Channels</h1>
          <p className="text-gray-500 text-sm mt-1">
            {channels.length} / {channelLimit} channels connected
            {user?.plan && (
              <span className="ml-2 text-brand capitalize">({user.plan} plan)</span>
            )}
          </p>
        </div>

        {/* FIX 2: connectYouTube directly call karo */}
        <Button
          onClick={connectYouTube}
          disabled={!canAdd || isLoading}
          loading={isLoading}
        >
          <Plus size={16} className="mr-2" />
          Connect Channel
        </Button>
      </div>

      {/* Plan limit reached */}
      {!canAdd && (
        <div className="mb-4 p-4 rounded-xl border border-amber/20 bg-amber/5">
          <p className="text-amber text-sm">
            <span className="font-medium">Channel limit reached.</span>{' '}
            Your {user?.plan} plan allows {channelLimit} channel(s).{' '}
            <a href="/pricing" className="underline hover:text-amber-300">Upgrade to add more.</a>
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && channels.length === 0 && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* No channels */}
      {!isLoading && channels.length === 0 && (
        <Card className="text-center py-14">
          <Youtube size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-white font-semibold mb-2">No channels connected</h3>
          <p className="text-gray-500 text-sm mb-6">
            Connect your YouTube channel to start managing your content.
          </p>
          <Button onClick={connectYouTube} loading={isLoading}>
            <Plus size={16} className="mr-2" />
            Connect YouTube Channel
          </Button>
        </Card>
      )}

      {/* Channels list */}
      {channels.length > 0 && (
        <div className="space-y-3">
          {channels.map((channel) => (
            <Card key={channel._id} className="flex items-center gap-4">

              {/* Thumbnail */}
              <div className="relative flex-shrink-0">
                {channel.thumbnail ? (
                  <img
                    src={channel.thumbnail}
                    alt={channel.channelName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                    <Youtube size={20} className="text-gray-500" />
                  </div>
                )}

                {/* Connection status dot */}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface
                  ${channel.connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold truncate">
                    {channel.channelName}
                  </h3>
                  {channel.isPrimary && (
                    <Badge variant="brand" size="sm">Primary</Badge>
                  )}
                  <Badge variant={statusColor[channel.connectionStatus] || 'default'} size="sm">
                    {statusLabel[channel.connectionStatus] || channel.connectionStatus}
                  </Badge>
                </div>

                {channel.channelHandle && (
                  <p className="text-gray-500 text-xs mt-0.5">@{channel.channelHandle.replace('@', '')}</p>
                )}

                {/* Stats */}
                <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                  <span>{Number(channel.stats?.subscriberCount || 0).toLocaleString()} subscribers</span>
                  <span>{Number(channel.stats?.videoCount || 0).toLocaleString()} videos</span>
                  <span>{Number(channel.stats?.viewCount || 0).toLocaleString()} views</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">

                {/* Reconnect required warning */}
                {(channel.connectionStatus === 'reconnect_required' ||
                  channel.connectionStatus === 'token_expired') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={connectYouTube}
                    className="text-amber border-amber/40 hover:bg-amber/10"
                  >
                    <WifiOff size={14} className="mr-1.5" />
                    Reconnect
                  </Button>
                )}

                {/* Sync */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => syncChannel(channel._id)}
                  title="Sync stats"
                >
                  <RefreshCw size={14} />
                </Button>

                {/* Set Primary */}
                {!channel.isPrimary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPrimary(channel._id)}
                    title="Set as primary"
                  >
                    <Star size={14} />
                  </Button>
                )}

                {/* Disconnect */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Disconnect "${channel.channelName}"?`)) {
                      disconnectChannel(channel._id)
                    }
                  }}
                  className="text-gray-500 hover:text-rose-400"
                  title="Disconnect"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl border border-gray-800 bg-gray-900/50">
        <p className="text-gray-500 text-xs leading-relaxed">
          <span className="text-gray-300 font-medium">How it works: </span>
          Clicking "Connect Channel" opens a Google OAuth popup. After you grant access,
          the popup closes and your channel appears here automatically.
          Your credentials are stored securely and never shared.
        </p>
      </div>
    </div>
  )
}
