// src/pages/growth/Growth.jsx
import { useState, useEffect } from 'react'
import { TrendingUp, Search, Plus, RefreshCw, Zap, Target, Flame } from 'lucide-react'
import { useChannelStore } from '../../store/channelStore'
import { analyticsApi } from '../../api/analytics.api'
import { GrowthPredictionCard, SuggestionsCard } from '../../components/features/GrowthCard'
import { CompetitorCard } from '../../components/features/CompetitorCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { useAuthStore } from '../../store/authStore'
import { formatNumber } from '../../utils/formatters'
import toast from 'react-hot-toast'

export const Growth = () => {
  const { activeChannel } = useChannelStore()
  const { user } = useAuthStore()
  const channelId = activeChannel?._id

  const [growth, setGrowth] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState(null)
  const [showAddCompetitor, setShowAddCompetitor] = useState(false)
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [addingCompetitor, setAddingCompetitor] = useState(false)

  const canAccessCompetitors = ['pro', 'agency'].includes(user?.plan)
  const canAccessTrends = ['pro', 'agency'].includes(user?.plan)

  const fetchAll = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const promises = [
        analyticsApi.getGrowth(channelId),
        analyticsApi.getSuggestions(channelId),
      ]
      if (canAccessCompetitors) promises.push(analyticsApi.getCompetitors(channelId))
      if (canAccessTrends) promises.push(analyticsApi.getTrends(channelId))

      const results = await Promise.allSettled(promises)
      if (results[0].status === 'fulfilled') setGrowth(results[0].value.data.data)
      if (results[1].status === 'fulfilled') setSuggestions(results[1].value.data.data?.suggestions || [])
      if (canAccessCompetitors && results[2]?.status === 'fulfilled') setCompetitors(results[2].value.data.data || [])
      if (canAccessTrends && results[3]?.status === 'fulfilled') setTrends(results[3].value.data.data?.trends || [])
    } catch {
      toast.error('Failed to load growth data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [channelId])

  const handleAddCompetitor = async () => {
    if (!competitorUrl.trim()) { toast.error('Enter a channel ID or URL'); return }
    setAddingCompetitor(true)
    try {
      // Extract channel ID from URL if needed
      let channelId_yt = competitorUrl.trim()
      if (channelUrl.includes('youtube.com/channel/')) {
        channelId_yt = competitorUrl.split('youtube.com/channel/')[1].split('/')[0]
      } else if (competitorUrl.includes('youtube.com/@')) {
        channelId_yt = competitorUrl // handle will be resolved by backend
      }
      await analyticsApi.addCompetitor(channelId, channelId_yt)
      toast.success('Competitor added!')
      setShowAddCompetitor(false)
      setCompetitorUrl('')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add competitor')
    } finally {
      setAddingCompetitor(false)
    }
  }

  const handleSyncCompetitor = async (competitorId) => {
    setSyncingId(competitorId)
    try {
      await analyticsApi.syncCompetitor(competitorId)
      toast.success('Competitor synced!')
      fetchAll()
    } catch { toast.error('Sync failed') }
    finally { setSyncingId(null) }
  }

  const handleRemoveCompetitor = async (competitorId) => {
    try {
      await analyticsApi.removeCompetitor(competitorId)
      setCompetitors(prev => prev.filter(c => c._id !== competitorId))
      toast.success('Competitor removed')
    } catch { toast.error('Failed to remove') }
  }

  const opportunityColor = (score) =>
    score >= 80 ? 'emerald' : score >= 60 ? 'brand' : score >= 40 ? 'amber' : 'gray'

  if (!channelId) {
    return (
      <div className="text-center py-20 text-gray-500">
        <TrendingUp size={40} className="mx-auto mb-4 opacity-30" />
        <p>Connect a YouTube channel to view growth intelligence</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Growth + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GrowthPredictionCard data={growth} loading={loading} />
        <SuggestionsCard suggestions={suggestions} loading={loading} />
      </div>

      {/* Competitor Tracker */}
      <Card>
        <CardHeader
          title="Competitor Tracker"
          subtitle={canAccessCompetitors ? `${competitors.length} tracked` : 'PRO feature'}
          icon={Target}
          iconColor={canAccessCompetitors ? 'cyan' : 'gray'}
          action={
            canAccessCompetitors ? (
              <Button size="xs" icon={Plus} onClick={() => setShowAddCompetitor(true)}>
                Add
              </Button>
            ) : (
              <Badge variant="cyan" size="xs">PRO</Badge>
            )
          }
        />

        {!canAccessCompetitors ? (
          <div className="text-center py-8">
            <Target size={32} className="mx-auto mb-3 text-gray-700" />
            <p className="text-sm text-gray-500 mb-3">
              Track competitors and steal their strategy
            </p>
            <Badge variant="cyan">Upgrade to PRO to unlock</Badge>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array(3).fill(0).map((_, i) => <div key={i} className="shimmer h-28 rounded-xl" />)}
          </div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm mb-3">No competitors tracked yet</p>
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setShowAddCompetitor(true)}>
              Add Competitor
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {competitors.map(c => (
              <CompetitorCard
                key={c._id}
                competitor={c}
                onSync={handleSyncCompetitor}
                onRemove={handleRemoveCompetitor}
                syncing={syncingId === c._id}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Trend Scanner */}
      <Card>
        <CardHeader
          title="Trend Opportunity Scanner"
          subtitle={canAccessTrends ? 'Rising topics in your niche' : 'PRO feature'}
          icon={Flame}
          iconColor={canAccessTrends ? 'rose' : 'gray'}
          action={!canAccessTrends && <Badge variant="cyan" size="xs">PRO</Badge>}
        />

        {!canAccessTrends ? (
          <div className="text-center py-8">
            <Flame size={32} className="mx-auto mb-3 text-gray-700" />
            <p className="text-sm text-gray-500 mb-3">
              Detect rising topics before they peak — be first
            </p>
            <Badge variant="cyan">Upgrade to PRO to unlock</Badge>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array(4).fill(0).map((_, i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {trends.map((trend, i) => (
              <div key={i} className="flex items-center gap-3 p-3 glass rounded-xl hover:border-white/12 transition-all">
                <div className="w-8 h-8 rounded-lg bg-rose/10 flex items-center justify-center shrink-0 text-sm">
                  {i === 0 ? '🔥' : i === 1 ? '⚡' : '📈'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{trend.keyword}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {trend.category && <span className="text-2xs text-gray-500">{trend.category}</span>}
                    {trend.growthRate && (
                      <span className="text-2xs text-emerald">+{trend.growthRate}% growth</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold text-${opportunityColor(trend.opportunityScore)}`}>
                    {trend.opportunityScore}/100
                  </p>
                  <Badge
                    variant={trend.status === 'rising' ? 'emerald' : trend.status === 'peaking' ? 'rose' : 'gray'}
                    size="xs"
                    dot={trend.status === 'rising'}
                  >
                    {trend.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Competitor Modal */}
      <Modal
        isOpen={showAddCompetitor}
        onClose={() => setShowAddCompetitor(false)}
        title="Add Competitor"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowAddCompetitor(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddCompetitor} loading={addingCompetitor}>Add</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="YouTube Channel ID or URL"
            placeholder="UCxxxxxx or youtube.com/channel/UC..."
            value={competitorUrl}
            onChange={e => setCompetitorUrl(e.target.value)}
            hint="Find it in YouTube Studio → Customization → Channel URL"
          />
          <div className="p-3 bg-brand/5 border border-brand/15 rounded-xl">
            <p className="text-xs text-gray-400">
              PRO plan allows tracking up to 3 competitors.
              Agency plan allows unlimited.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
