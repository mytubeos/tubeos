// src/pages/admin/AdminUsers.jsx
import { useEffect, useState, useCallback } from 'react'
import {
  Search, Crown, UserX, UserCheck, ChevronLeft, ChevronRight,
  ShieldOff, ShieldCheck, Mail, Calendar, Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import adminAPI from '../../api/admin.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLANS = ['free', 'creator', 'pro', 'agency']
const PLAN_META = {
  free:    { color: 'gray',    label: 'Free' },
  creator: { color: 'brand',   label: 'Creator' },
  pro:     { color: 'cyan',    label: 'Pro' },
  agency:  { color: 'rose',    label: 'Agency' },
}

const PLAN_PRICES = { creator: '₹199/mo', pro: '₹499/mo', agency: '₹2999/mo', free: 'Free' }

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'
const fmtTime = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'

const Avatar = ({ name, size = 32 }) => {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  const colors = ['bg-brand/20 text-brand', 'bg-cyan/20 text-cyan', 'bg-amber/20 text-amber', 'bg-rose/20 text-rose', 'bg-emerald/20 text-emerald']
  const idx = name?.charCodeAt(0) % colors.length || 0
  return (
    <div
      className={`${colors[idx]} rounded-full flex items-center justify-center font-bold text-xs shrink-0`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  )
}

// ─── Plan Change Modal ────────────────────────────────────────────────────────

const PlanModal = ({ user, onClose, onChanged }) => {
  const [selected, setSelected] = useState(user?.plan || 'free')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (selected === user.plan) return onClose()
    setSaving(true)
    try {
      await adminAPI.changeUserPlan(user._id, selected)
      toast.success(`Plan changed to ${selected}`)
      onChanged()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={!!user}
      onClose={onClose}
      title="Change Plan"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          Changing plan for <span className="text-white font-medium">{user?.name}</span>
        </p>
        {PLANS.map(plan => {
          const { color, label } = PLAN_META[plan]
          return (
            <button
              key={plan}
              onClick={() => setSelected(plan)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                          ${selected === plan
                            ? `bg-${color}/10 border-${color}/30`
                            : 'glass border-white/10 hover:border-white/20'}`}
            >
              <div className="flex items-center gap-3">
                <Crown size={15} className={selected === plan ? `text-${color}` : 'text-gray-500'} />
                <span className={`text-sm font-medium capitalize ${selected === plan ? `text-${color}` : 'text-gray-300'}`}>
                  {label}
                </span>
              </div>
              <span className="text-xs text-gray-500">{PLAN_PRICES[plan]}</span>
            </button>
          )
        })}
        {selected !== 'free' && (
          <p className="text-xs text-amber/70 bg-amber/5 border border-amber/10 rounded-lg px-3 py-2">
            Manual plan — expires in 30 days. No actual payment collected.
          </p>
        )}
      </div>
    </Modal>
  )
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────

const BanModal = ({ user, onClose, onBanned }) => {
  const [reason, setReason] = useState('')
  const [banning, setBanning] = useState(false)

  const handleBan = async () => {
    setBanning(true)
    try {
      await adminAPI.toggleBanUser(user._id, reason || 'Admin action')
      toast.success('User banned')
      onBanned()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to ban user')
    } finally {
      setBanning(false)
    }
  }

  return (
    <Modal
      isOpen={!!user}
      onClose={onClose}
      title="Ban User"
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" loading={banning} onClick={handleBan} icon={ShieldOff}>
            Ban User
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          Ban <span className="text-white font-medium">{user?.name}</span> ({user?.email})?
          They won't be able to login.
        </p>
        <div>
          <label className="text-xs font-medium text-gray-400 mb-1.5 block">Reason (optional)</label>
          <textarea
            rows={3}
            className="input-field resize-none text-sm"
            placeholder="e.g. Violating terms of service..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Users Page ──────────────────────────────────────────────────────────

export const AdminUsers = () => {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [planTarget, setPlanTarget]   = useState(null)
  const [banTarget, setBanTarget]     = useState(null)
  const [unbanTarget, setUnbanTarget] = useState(null)
  const [unbanning, setUnbanning]     = useState(false)

  const LIMIT = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listUsers({
        page, limit: LIMIT,
        ...(planFilter   && { plan: planFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(search       && { search }),
      })
      setUsers(res.data.data)
      setTotal(res.data.meta.pagination.total)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, planFilter, statusFilter, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleUnban = async () => {
    setUnbanning(true)
    try {
      await adminAPI.toggleBanUser(unbanTarget._id)
      toast.success('User unbanned')
      setUnbanTarget(null)
      fetchUsers()
    } catch {
      toast.error('Failed to unban user')
    } finally {
      setUnbanning(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-9 h-9 text-xs"
            placeholder="Search name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <select
          value={planFilter}
          onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          className="input-field h-9 text-xs bg-base-600 w-36"
        >
          <option value="" className="bg-base-500">All Plans</option>
          {PLANS.map(p => (
            <option key={p} value={p} className="bg-base-500 capitalize">{PLAN_META[p].label}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="input-field h-9 text-xs bg-base-600 w-36"
        >
          <option value="" className="bg-base-500">All Status</option>
          <option value="active" className="bg-base-500">Active</option>
          <option value="banned" className="bg-base-500">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {['User', 'Plan', 'Status', 'Joined', 'Last Login', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="shimmer w-8 h-8 rounded-full" />
                        <div className="space-y-1.5">
                          <div className="shimmer h-3 w-28 rounded" />
                          <div className="shimmer h-2.5 w-36 rounded" />
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="shimmer h-3 rounded w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-500 text-sm">
                    No users found.
                  </td>
                </tr>
              )
              : users.map(u => (
                <tr
                  key={u._id}
                  className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors
                              ${u.isBanned ? 'opacity-60' : ''}`}
                >
                  {/* User */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{u.name}</span>
                          {u.isEmailVerified && (
                            <ShieldCheck size={11} className="text-emerald" title="Email verified" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Mail size={10} />
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3.5">
                    <Badge variant={PLAN_META[u.plan]?.color || 'gray'} size="xs">
                      {PLAN_META[u.plan]?.label || u.plan}
                    </Badge>
                    {u.subscriptionExpiresAt && u.plan !== 'free' && (
                      <p className="text-2xs text-gray-600 mt-0.5">
                        until {fmt(u.subscriptionExpiresAt)}
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {u.isBanned
                      ? <Badge variant="rose" size="xs"><ShieldOff size={9} className="mr-0.5" />Banned</Badge>
                      : <Badge variant="emerald" size="xs" dot>Active</Badge>
                    }
                    {u.isBanned && u.bannedReason && (
                      <p className="text-2xs text-gray-600 mt-0.5 max-w-24 truncate" title={u.bannedReason}>
                        {u.bannedReason}
                      </p>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={11} />
                      {fmt(u.createdAt)}
                    </div>
                  </td>

                  {/* Last Login */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {fmtTime(u.lastLoginAt)}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPlanTarget(u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                                   glass border border-white/10 text-gray-400
                                   hover:border-brand/30 hover:text-brand transition-all"
                        title="Change Plan"
                      >
                        <Crown size={12} /> Plan
                      </button>
                      {u.isBanned
                        ? (
                          <button
                            onClick={() => setUnbanTarget(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                                       glass border border-emerald/20 text-emerald/70
                                       hover:border-emerald/40 hover:text-emerald transition-all"
                            title="Unban"
                          >
                            <UserCheck size={12} /> Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => setBanTarget(u)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
                                       glass border border-rose/20 text-rose/60
                                       hover:border-rose/40 hover:text-rose transition-all"
                            title="Ban"
                          >
                            <UserX size={12} /> Ban
                          </button>
                        )
                      }
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 glass rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-400">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 glass rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {planTarget && (
        <PlanModal
          user={planTarget}
          onClose={() => setPlanTarget(null)}
          onChanged={fetchUsers}
        />
      )}

      {/* Ban Modal */}
      {banTarget && (
        <BanModal
          user={banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={fetchUsers}
        />
      )}

      {/* Unban Confirm */}
      <ConfirmModal
        isOpen={!!unbanTarget}
        onClose={() => setUnbanTarget(null)}
        onConfirm={handleUnban}
        title="Unban User"
        message={`Unban "${unbanTarget?.name}"? They will be able to login again.`}
        confirmLabel="Unban"
        loading={unbanning}
      />
    </div>
  )
}
