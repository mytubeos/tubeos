// src/pages/admin/AdminPlanLimits.jsx
import { useEffect, useState } from 'react'
import { Pencil, Gauge } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PLANS as PLAN_NAMES } from '../../utils/constants'
import adminAPI from '../../api/admin.api'

const PLANS = ['free', 'creator', 'pro', 'agency']

const LIMIT_FIELDS = [
  { key: 'uploads', label: 'Uploads/mo' },
  { key: 'aiReplies', label: 'AI Replies/mo' },
  { key: 'aiContent', label: 'AI Content/mo' },
  { key: 'bulkReplies', label: 'Bulk Replies/mo' },
  { key: 'thumbnailGen', label: 'Thumbnails/mo' },
]

const formatLimit = (value) => (value === null || value === undefined ? 'Unlimited' : value)

// ─── Edit Form Modal ────────────────────────────────────────────────────────

const emptyForm = (limits) => {
  const form = {}
  for (const { key } of LIMIT_FIELDS) {
    const value = limits?.[key]
    form[key] = { value: value != null ? String(value) : '', unlimited: value === null }
  }
  return form
}

const LimitsForm = ({ isOpen, onClose, plan, limits, onSaved }) => {
  const [form, setForm] = useState(() => emptyForm(limits))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setForm(emptyForm(limits))
  }, [isOpen, limits])

  const setField = (key, field, value) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }))

  const handleSubmit = async () => {
    const payload = {}
    for (const { key, label } of LIMIT_FIELDS) {
      const { value, unlimited } = form[key]
      if (unlimited) {
        payload[key] = null
        continue
      }
      if (value === '' || isNaN(value) || Number(value) < 0) {
        return toast.error(`Enter a valid ${label} value, or mark it Unlimited`)
      }
      payload[key] = Math.round(Number(value))
    }

    setSaving(true)
    try {
      await adminAPI.updateLimits(plan, payload)
      toast.success('Limits updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save limits')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${PLAN_NAMES[plan]?.name || plan} limits`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" loading={saving} onClick={handleSubmit}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          How many of each action a {PLAN_NAMES[plan]?.name || plan} user gets per month. Check
          Unlimited instead of typing a number for no cap.
        </p>
        {LIMIT_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label={label}
                name={`limit-${key}`}
                type="number"
                min="0"
                placeholder="e.g. 20"
                value={form[key].value}
                disabled={form[key].unlimited}
                onChange={(e) => setField(key, 'value', e.target.value)}
              />
            </div>
            <label className="flex items-center gap-1.5 pb-2.5 text-xs text-gray-400 select-none">
              <input
                type="checkbox"
                className="accent-brand"
                checked={form[key].unlimited}
                onChange={(e) => setField(key, 'unlimited', e.target.checked)}
              />
              Unlimited
            </label>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Main Plan Limits Page ──────────────────────────────────────────────────

export const AdminPlanLimits = () => {
  const [limitsByPlan, setLimitsByPlan] = useState({})
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(null)

  const fetchLimits = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getLimits()
      setLimitsByPlan(res.data.data || {})
    } catch {
      toast.error('Failed to load limits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLimits()
  }, [])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Plan Limits</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            How much of each feature every plan gets per month. Takes effect immediately — no deploy
            needed.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {['Plan', ...LIMIT_FIELDS.map((f) => f.label), ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-2xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: LIMIT_FIELDS.length + 2 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="shimmer h-3 rounded w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                : PLANS.map((plan) => {
                    const limits = limitsByPlan[plan]
                    return (
                      <tr
                        key={plan}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-medium text-white">
                            {PLAN_NAMES[plan]?.name || plan}
                          </span>
                        </td>
                        {LIMIT_FIELDS.map(({ key }) => (
                          <td key={key} className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-sm text-gray-200">
                              {formatLimit(limits?.[key])}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setEditPlan(plan)}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/5 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-2xs text-gray-600 mt-3">
        <Gauge size={11} />
        Changes apply to every user on that plan going forward — doesn't retroactively reset
        anyone's usage already counted this month.
      </p>

      {/* Edit Modal */}
      {editPlan && (
        <LimitsForm
          isOpen={!!editPlan}
          onClose={() => setEditPlan(null)}
          plan={editPlan}
          limits={limitsByPlan[editPlan]}
          onSaved={fetchLimits}
        />
      )}
    </div>
  )
}
