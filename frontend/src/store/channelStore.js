// src/store/channelStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { youtubeApi } from '../api/youtube.api'

export const useChannelStore = create(
  persist(
    (set, get) => ({
      channels: [],
      activeChannel: null,
      isLoading: false,

      // Fetch all channels
      fetchChannels: async () => {
        set({ isLoading: true })
        try {
          const res = await youtubeApi.getChannels()
          const channels = res.data.data || []
          const active = get().activeChannel
          // Keep active channel if still valid
          const stillValid = channels.find(c => c._id === active?._id)
          set({
            channels,
            activeChannel: stillValid || channels.find(c => c.isPrimary) || channels[0] || null,
            isLoading: false,
          })
        } catch {
          set({ isLoading: false })
        }
      },

      // Set active channel
      setActiveChannel: (channel) => set({ activeChannel: channel }),

      // Add channel
      addChannel: (channel) => {
        set(state => ({
          channels: [...state.channels, channel],
          activeChannel: state.activeChannel || channel,
        }))
      },

      // Remove channel
      removeChannel: (channelId) => {
        set(state => {
          const channels = state.channels.filter(c => c._id !== channelId)
          const active = state.activeChannel?._id === channelId
            ? channels[0] || null
            : state.activeChannel
          return { channels, activeChannel: active }
        })
      },

      // Update channel stats
      updateChannelStats: (channelId, stats) => {
        set(state => ({
          channels: state.channels.map(c =>
            c._id === channelId ? { ...c, stats: { ...c.stats, ...stats } } : c
          ),
          activeChannel: state.activeChannel?._id === channelId
            ? { ...state.activeChannel, stats: { ...state.activeChannel.stats, ...stats } }
            : state.activeChannel,
        }))
      },

      // Clear
      clearChannels: () => set({ channels: [], activeChannel: null }),
    }),
    {
      name: 'tubeos-channels',
      partialize: (state) => ({
        channels: state.channels,
        activeChannel: state.activeChannel,
      }),
    }
  )
)
