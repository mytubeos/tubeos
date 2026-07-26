// src/components/layout/Navbar.jsx
import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, ChevronDown, Check, Menu } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { Button } from '../ui/Button'
import { Chingari } from '../features/Chingari'
import { formatNumber, timeAgo } from '../../utils/formatters'
import { useNavigate } from 'react-router-dom'
import notificationAPI from '../../api/notification.api'

const NOTIF_POLL_MS = 2 * 60 * 1000

export const Navbar = ({ title, onMenuClick }) => {
  const { channels, activeChannel, setActiveChannel } = useChannelStore()
  const [showChannels, setShowChannels] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 15 })
      setNotifications(res.data.data?.notifications || [])
      setUnreadCount(res.data.data?.unreadCount || 0)
    } catch {
      // Silent — the bell just stays at its last-known state, no toast spam
      // for a background poll.
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, NOTIF_POLL_MS)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleOpenNotifs = () => {
    setShowNotifs((v) => !v)
    if (!showNotifs) fetchNotifications()
  }

  const handleItemClick = async (n) => {
    if (n.read) return
    setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)))
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await notificationAPI.markRead(n._id)
    } catch {
      // Best-effort — a stale "read" state locally is harmless
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    try {
      await notificationAPI.markAllRead()
    } catch {
      // Best-effort, same as above
    }
  }

  return (
    <header
      className="h-14 bg-base-800/80 backdrop-blur-sm border-b border-white/8
                        flex items-center justify-between px-5 sticky top-0 z-30"
    >
      {/* Left — Menu toggle (mobile) + Page title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="md:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center shrink-0
                     text-gray-400 hover:text-white hover:bg-white/6 transition-all"
        >
          <Menu size={19} />
        </button>
        <h1 className="font-display font-bold text-white text-lg truncate">{title}</h1>
      </div>

      {/* Right — Controls */}
      <div className="flex items-center gap-2 shrink-0">
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
                  src={
                    activeChannel.thumbnail ||
                    `https://ui-avatars.com/api/?name=${activeChannel.channelName}&background=4F46E5&color=fff`
                  }
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
                <div
                  className="absolute right-0 top-11 w-64 bg-base-700 border border-white/10
                                rounded-xl shadow-2xl z-20 overflow-hidden animate-slide-up"
                >
                  <div className="p-2 space-y-0.5">
                    {channels.map((ch) => (
                      <button
                        key={ch._id}
                        onClick={() => {
                          setActiveChannel(ch)
                          setShowChannels(false)
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                    text-left transition-all text-sm
                                    ${
                                      activeChannel?._id === ch._id
                                        ? 'bg-brand/15 text-brand'
                                        : 'text-gray-300 hover:bg-white/5'
                                    }`}
                      >
                        <img
                          src={
                            ch.thumbnail ||
                            `https://ui-avatars.com/api/?name=${ch.channelName}&background=4F46E5&color=fff`
                          }
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
                      onClick={() => {
                        navigate('/channels')
                        setShowChannels(false)
                      }}
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
        <div className="relative">
          <button
            onClick={handleOpenNotifs}
            aria-label="Notifications"
            className="relative w-9 h-9 rounded-lg glass flex items-center justify-center
                             text-gray-400 hover:text-white hover:bg-white/6 transition-all"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full
                               ring-1 ring-base-800 animate-pulse"
              />
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div
                className="absolute right-0 top-11 w-80 bg-base-700 border border-white/10
                              rounded-xl shadow-2xl z-20 overflow-hidden animate-slide-up"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/8">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-2xs text-gray-500 hover:text-brand transition-colors"
                    >
                      <Check size={11} />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Chingari mood="idle" size={40} className="mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Sab clear hai, kuch naya nahi hai</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n._id}
                        onClick={() => handleItemClick(n)}
                        className={`w-full flex items-start gap-2.5 px-3.5 py-3 text-left
                                    border-b border-white/5 last:border-0 transition-all
                                    hover:bg-white/5 ${!n.read ? 'bg-brand/5' : ''}`}
                      >
                        <Chingari mood={n.mood} size={30} className="shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-200 leading-relaxed">{n.message}</p>
                          <p className="text-2xs text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
