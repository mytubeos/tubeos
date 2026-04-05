// src/components/layout/Navbar.jsx
import { useState } from 'react'
import { Bell, Search, Plus, ChevronDown, RefreshCw } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../ui/Button'
import { formatNumber } from '../../utils/formatters'
import { useNavigate } from 'react-router-dom'

export const Navbar = ({ title }) => {
  const { channels, activeChannel, setActiveChannel } = useChannelStore()
  const { user } = useAuthStore()
  const [showChannels, setShowChannels] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="h-14 bg-base-800/80 backdrop-blur-sm border-b border-white/8
                        flex items-center justify-between px-5 sticky top-0 z-30">

      {/* Left — Page title */}
      <h1 className="font-display font-bold text-white text-lg">{title}</h1>

      {/* Right — Controls */}
      <div className="flex items-center gap-2">

        {/* Channel Switcher */}
        {channels.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowChannels(!showChannels)}
              className="flex items-center gap-2 h-9 px-3 rounded-lg glass
                         hover:bg-white/6 transition-all text-sm"
            >
              {activeChannel && (
                <img
                  src={activeChannel.thumbnail || `https://ui-avatars.com/api/?name=${activeChannel.channelName}&background=4F46E5&color=fff`}
                  className="w-5 h-5 rounded-full object-cover"
                  alt=""
                />
              )}
              <span className="text-gray-300 text-sm max-w-[140px] truncate">
                {activeChannel?.channelName || 'Select Channel'}
              </span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>

            {/* Dropdown */}
            {showChannels && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowChannels(false)} />
                <div className="absolute right-0 top-11 w-64 bg-base-700 border border-white/10
                                rounded-xl shadow-2xl z-20 overflow-hidden animate-slide-up">
                  <div className="p-2 space-y-0.5">
                    {channels.map(ch => (
                      <button
                        key={ch._id}
                        onClick={() => { setActiveChannel(ch); setShowChannels(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    text-left transition-all text-sm
                                    ${activeChannel?._id === ch._id
                                      ? 'bg-brand/15 text-brand'
                                      : 'text-gray-300 hover:bg-white/5'}`}
                      >
                        <img
                          src={ch.thumbnail || `https://ui-avatars.com/api/?name=${ch.channelName}&background=4F46E5&color=fff`}
                          className="w-7 h-7 rounded-full object-cover"
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{ch.channelName}</p>
                          <p className="text-2xs text-gray-500">
                            {formatNumber(ch.stats?.subscriberCount)} subs
                          </p>
                        </div>
                        {ch.isPrimary && (
                          <span className="ml-auto text-2xs text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                            Primary
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-white/8 p-2">
                    <button
                      onClick={() => { navigate('/channels'); setShowChannels(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm
                                 text-gray-400 hover:text-brand rounded-lg hover:bg-brand/5 transition-all"
                    >
                      <Plus size={14} />
                      Add Channel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Quick Upload */}
        <Button
          size="sm"
          onClick={() => navigate('/videos/upload')}
          icon={Plus}
          className="hidden sm:flex"
        >
          Upload
        </Button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg glass flex items-center justify-center
                           text-gray-400 hover:text-white hover:bg-white/6 transition-all">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full
                           ring-1 ring-base-800 animate-pulse" />
        </button>
      </div>
    </header>
  )
}
