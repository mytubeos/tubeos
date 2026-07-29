// src/pages/videos/Videos.jsx
import { useState, useEffect } from 'react'
import { Plus, Search, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useChannelStore } from '../../store/channelStore'
import { videoApi } from '../../api/video.api'
import { scheduleApi } from '../../api/schedule.api'
import { VideoCard } from '../../components/features/VideoCard'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import toast from 'react-hot-toast'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Drafts' },
  { value: 'failed', label: 'Failed' },
]

export const Videos = () => {
  const navigate = useNavigate()
  const { activeChannel } = useChannelStore()
  const channelId = activeChannel?._id

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteFromYT, setDeleteFromYT] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchVideos = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const params = { page, limit: 12, channelId }
      if (statusFilter) params.status = statusFilter
      if (search) params.search = search
      const res = await videoApi.getAll(params)
      setVideos(res.data.data || [])
      setTotal(res.data.meta?.pagination?.total || 0)
    } catch {
      toast.error('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [channelId, statusFilter, page])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (channelId) fetchVideos()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const deleteTarget = videos.find((v) => v._id === deleteId)

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await videoApi.delete(deleteId, deleteFromYT)
      toast.success(res.data.message || 'Video deleted')
      setVideos((prev) => prev.filter((v) => v._id !== deleteId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete video')
    } finally {
      setDeleting(false)
      setDeleteId(null)
      setDeleteFromYT(false)
    }
  }

  const handleCancelSchedule = async (videoId) => {
    try {
      await scheduleApi.cancel(videoId)
      toast.success('Schedule cancelled')
      fetchVideos()
    } catch {
      toast.error('Failed to cancel schedule')
    }
  }

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Video size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to manage videos</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />
        </div>
        <Button icon={Plus} onClick={() => navigate('/videos/upload')}>
          Upload
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center glass rounded-xl p-1 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setStatusFilter(f.value)
              setPage(1)
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${
                          statusFilter === f.value
                            ? 'bg-brand text-white shadow-lg'
                            : 'text-gray-400 hover:text-white'
                        }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <p className="text-sm text-gray-500">
        Showing {videos.length} of {total} videos
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <div className="shimmer aspect-video" />
                <div className="p-3 space-y-2">
                  <div className="shimmer h-4 rounded w-3/4" />
                  <div className="shimmer h-3 rounded w-1/2" />
                </div>
              </div>
            ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Video size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm mb-4">
            {search || statusFilter ? 'No videos match your filters' : 'No videos yet'}
          </p>
          {!search && !statusFilter && (
            <Button icon={Plus} onClick={() => navigate('/videos/upload')}>
              Upload Your First Video
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard
              key={video._id}
              video={video}
              onDelete={setDeleteId}
              onCancel={handleCancelSchedule}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">Page {page}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={videos.length < 12}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => {
          setDeleteId(null)
          setDeleteFromYT(false)
        }}
        title="Delete Video"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteId(null)
                setDeleteFromYT(false)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-400 text-sm mb-3">
          Are you sure you want to delete{' '}
          {deleteTarget?.title ? (
            <span className="text-white">"{deleteTarget.title}"</span>
          ) : (
            'this video'
          )}
          ?
        </p>

        {deleteTarget?.youtubeVideoId && (
          <label className="flex items-start gap-2.5 p-3 glass rounded-xl cursor-pointer hover:bg-white/[0.04] transition-colors">
            <input
              type="checkbox"
              checked={deleteFromYT}
              onChange={(e) => setDeleteFromYT(e.target.checked)}
              className="mt-0.5 accent-rose"
            />
            <span className="text-sm text-gray-300">
              Also delete from YouTube{' '}
              <span className="text-rose text-xs">(permanent — cannot be undone)</span>
            </span>
          </label>
        )}

        <p className="text-xs text-gray-600 mt-2">
          {deleteTarget?.youtubeVideoId
            ? deleteFromYT
              ? 'This video will be permanently removed from YouTube too, along with all its views, likes, and comments.'
              : "Only removes it from Vezrin's dashboard. The video stays live on YouTube."
            : "This video only exists in Vezrin's dashboard — nothing to remove from YouTube."}
        </p>
      </Modal>
    </div>
  )
}
