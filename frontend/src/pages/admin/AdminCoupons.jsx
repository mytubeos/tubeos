// src/pages/admin/AdminCoupons.jsx
import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Lock,
  Globe,
  Copy,
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import adminAPI from '../../api/admin.api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLANS = ['creator', 'pro', 'agency']
const PLAN_COLORS = { creator: 'brand', pro: 'cyan', agency: 'rose' }

const randomCode = () => {
  const words = ['TUBE', 'OS', 'PRO', 'DEAL', 'SAVE', 'VIP', 'LAUNCH', 'BETA']
  const w = words[Math.floor(Math.random() * words.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  return `${w}${n}`
}

const formatDiscount = (c) =>
  c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue} off`

const formatExpiry = (d) => {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const isExpired = (d) => d && new Date(d) < new Date()

// ─── Coupon Form Modal ────────────────────────────────────────────────────────

const EMPTY_FORM = {
  code: '',
  type: 'public',
  discountType: 'percent',
  discountValue: '',
  validPlans: ['creator', 'pro', 'agency'],
  maxUses: '',
  expiresAt: '',
  description: '',
  isActive: true,
}

const CouponForm = ({ isOpen, onClose, editData, onSaved }) => {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm(
        editData
          ? {
              ...editData,
              discountValue: editData.discountValue?.toString() || '',
              maxUses: editData.maxUses?.toString() || '',
              expiresAt: editData.expiresAt
                ? new Date(editData.expiresAt).toISOString().split('T')[0]
                : '',
            }
          : EMPTY_FORM
      )
    }
  }, [isOpen, editData])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const togglePlan = (plan) => {
    setForm((f) => ({
      ...f,
      validPlans: f.validPlans.includes(plan)
        ? f.validPlans.filter((p) => p !== plan)
        : [...f.validPlans, plan],
    }))
  }

  const handleSubmit = async () => {
    if (!form.code.trim()) return toast.error('Coupon code is required')
    if (!form.discountValue || isNaN(form.discountValue))
      return toast.error('Valid discount value is required')
    if (form.validPlans.length === 0) return toast.error('Select at least one plan')

    setSaving(true)
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().trim(),
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
      }

      if (editData?._id) {
        await adminAPI.updateCoupon(editData._id, payload)
        toast.success('Coupon updated')
      } else {
        await adminAPI.createCoupon(payload)
        toast.success('Coupon created')
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save coupon')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editData ? 'Edit Coupon' : 'Create Coupon'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={handleSubmit}>
            {editData ? 'Save Changes' : 'Create Coupon'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Code */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">
            Coupon Code <span className="text-rose">*</span>
          </label>
          <div className="flex gap-2">
            <input
              className="input-field uppercase flex-1"
              placeholder="e.g. SAVE50"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
            />
            <button
              onClick={() => set('code', randomCode())}
              className="px-3 glass border border-white/10 rounded-lg text-gray-400
                         hover:text-white hover:border-white/20 transition-all"
              title="Auto-generate code"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(form.code)
                toast.success('Copied!')
              }}
              className="px-3 glass border border-white/10 rounded-lg text-gray-400
                         hover:text-white hover:border-white/20 transition-all"
              title="Copy code"
            >
              <Copy size={15} />
            </button>
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">Coupon Type</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: 'public',
                icon: Globe,
                label: 'Public',
                desc: 'Visible to users',
                color: 'brand',
              },
              {
                value: 'internal',
                icon: Lock,
                label: 'Internal',
                desc: 'Developer / team only',
                color: 'amber',
              },
            ].map(({ value, icon: Icon, label, desc, color }) => (
              <button
                key={value}
                onClick={() => set('type', value)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                            ${
                              form.type === value
                                ? `bg-${color}/10 border-${color}/30 text-${color}`
                                : 'glass border-white/10 text-gray-400 hover:border-white/20'
                            }`}
              >
                <Icon size={16} />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-2xs text-gray-500">{desc}</p>
                </div>
                {form.type === value && <Check size={14} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        {/* Discount */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Discount Type"
            value={form.discountType}
            onChange={(e) => set('discountType', e.target.value)}
            options={[
              { value: 'percent', label: 'Percentage (%)' },
              { value: 'fixed', label: 'Fixed Amount (₹)' },
            ]}
          />
          <Input
            label={form.discountType === 'percent' ? 'Discount %' : 'Discount ₹'}
            type="number"
            placeholder={form.discountType === 'percent' ? '50' : '100'}
            value={form.discountValue}
            onChange={(e) => set('discountValue', e.target.value)}
            hint={form.discountType === 'percent' ? 'Max 100' : 'In rupees'}
          />
        </div>

        {/* Valid Plans */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-1.5 block">Valid for Plans</label>
          <div className="flex gap-2">
            {PLANS.map((plan) => (
              <button
                key={plan}
                onClick={() => togglePlan(plan)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-all
                            ${
                              form.validPlans.includes(plan)
                                ? `bg-${PLAN_COLORS[plan]}/15 border-${PLAN_COLORS[plan]}/30 text-${PLAN_COLORS[plan]}`
                                : 'glass border-white/10 text-gray-500 hover:border-white/20'
                            }`}
              >
                {plan}
              </button>
            ))}
          </div>
        </div>

        {/* Max Uses + Expiry */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Max Uses"
            type="number"
            placeholder="Leave empty for unlimited"
            value={form.maxUses}
            onChange={(e) => set('maxUses', e.target.value)}
            hint="Unlimited if empty"
          />
          <Input
            label="Expiry Date"
            type="date"
            value={form.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
            hint="Never expires if empty"
          />
        </div>

        {/* Description */}
        <Input
          label="Internal Note"
          placeholder="e.g. For dev team testing, Q1 launch promo..."
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />

        {/* Active toggle */}
        <div className="flex items-center justify-between p-3 glass rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-300">Active</p>
            <p className="text-xs text-gray-500">Coupon can be used immediately</p>
          </div>
          <button
            onClick={() => set('isActive', !form.isActive)}
            className={`transition-colors ${form.isActive ? 'text-emerald' : 'text-gray-600'}`}
          >
            {form.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Coupons Page ────────────────────────────────────────────────────────

export const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editData, setEditData] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(null)

  const LIMIT = 15

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAPI.listCoupons({
        page,
        limit: LIMIT,
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(search && { search }),
      })
      setCoupons(res.data.data)
      setTotal(res.data.meta.pagination.total)
    } catch {
      toast.error('Failed to load coupons')
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter, statusFilter, search])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const openCreate = () => {
    setEditData(null)
    setFormOpen(true)
  }
  const openEdit = (c) => {
    setEditData(c)
    setFormOpen(true)
  }

  const handleToggle = async (coupon) => {
    setToggling(coupon._id)
    try {
      await adminAPI.updateCoupon(coupon._id, { isActive: !coupon.isActive })
      toast.success(coupon.isActive ? 'Coupon deactivated' : 'Coupon activated')
      fetchCoupons()
    } catch {
      toast.error('Failed to toggle coupon')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await adminAPI.deleteCoupon(deleteTarget._id)
      toast.success('Coupon deleted')
      setDeleteTarget(null)
      fetchCoupons()
    } catch {
      toast.error('Failed to delete coupon')
    } finally {
      setDeleting(false)
    }
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code)
    toast.success(`Copied: ${code}`)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Coupons</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} coupons total</p>
        </div>
        <Button icon={Plus} onClick={openCreate}>
          New Coupon
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-9 h-9 text-xs"
            placeholder="Search code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        {[
          {
            value: typeFilter,
            setter: setTypeFilter,
            options: [
              { value: '', label: 'All Types' },
              { value: 'public', label: 'Public' },
              { value: 'internal', label: 'Internal' },
            ],
          },
          {
            value: statusFilter,
            setter: setStatusFilter,
            options: [
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ].map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={(e) => {
              f.setter(e.target.value)
              setPage(1)
            }}
            className="input-field h-9 text-xs bg-base-600 w-36"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value} className="bg-base-500">
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {['Code', 'Type', 'Discount', 'Plans', 'Uses', 'Expiry', 'Status', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="shimmer h-3 rounded w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">
                  No coupons found. Create your first one.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr
                  key={c._id}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Code */}
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => copyCode(c.code)}
                      className="flex items-center gap-1.5 font-mono text-sm text-white
                                 hover:text-brand transition-colors group"
                    >
                      {c.code}
                      <Copy size={11} className="text-gray-600 group-hover:text-brand" />
                    </button>
                    {c.description && (
                      <p className="text-2xs text-gray-600 mt-0.5 truncate max-w-32">
                        {c.description}
                      </p>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3.5">
                    {c.type === 'internal' ? (
                      <Badge variant="amber" size="xs">
                        <Lock size={9} className="mr-0.5" />
                        Internal
                      </Badge>
                    ) : (
                      <Badge variant="brand" size="xs">
                        <Globe size={9} className="mr-0.5" />
                        Public
                      </Badge>
                    )}
                  </td>

                  {/* Discount */}
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-medium text-white">{formatDiscount(c)}</span>
                  </td>

                  {/* Plans */}
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {c.validPlans.map((p) => (
                        <Badge key={p} variant={PLAN_COLORS[p]} size="xs">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </td>

                  {/* Uses */}
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-300">{c.usedCount}</span>
                    <span className="text-xs text-gray-600">
                      {c.maxUses ? ` / ${c.maxUses}` : ' / ∞'}
                    </span>
                  </td>

                  {/* Expiry */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`text-xs ${isExpired(c.expiresAt) ? 'text-rose' : 'text-gray-400'}`}
                    >
                      {formatExpiry(c.expiresAt)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {isExpired(c.expiresAt) ? (
                      <Badge variant="rose" size="xs">
                        Expired
                      </Badge>
                    ) : c.isActive ? (
                      <Badge variant="emerald" size="xs" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="gray" size="xs">
                        Inactive
                      </Badge>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={toggling === c._id}
                        className={`p-1.5 rounded-lg transition-colors
                                    ${
                                      c.isActive
                                        ? 'text-emerald/70 hover:text-emerald hover:bg-emerald/10'
                                        : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'
                                    }`}
                        title={c.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {c.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-rose hover:bg-rose/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
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
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 glass rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 glass rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <CouponForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        editData={editData}
        onSaved={fetchCoupons}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Coupon"
        message={`Delete coupon "${deleteTarget?.code}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  )
}
