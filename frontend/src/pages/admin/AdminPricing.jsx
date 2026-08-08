// src/pages/admin/AdminPricing.jsx
import { useEffect, useState } from 'react'
import { Pencil, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { PLANS as PLAN_NAMES } from '../../utils/constants'
import { formatPrice } from '../../utils/currency'
import adminAPI from '../../api/admin.api'

const CURRENCIES = ['INR', 'EUR', 'USD']
const PLANS = ['creator', 'pro', 'agency']

// ─── Edit Form Modal ────────────────────────────────────────────────────────

const emptyForm = (prices) => {
  const form = {}
  for (const currency of CURRENCIES) {
    form[currency] = {
      amount: prices?.[currency]?.amount != null ? String(prices[currency].amount / 100) : '',
      regularAmount:
        prices?.[currency]?.regularAmount != null
          ? String(prices[currency].regularAmount / 100)
          : '',
    }
  }
  return form
}

const PricingForm = ({ isOpen, onClose, plan, prices, onSaved }) => {
  const [form, setForm] = useState(() => emptyForm(prices))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) setForm(emptyForm(prices))
  }, [isOpen, prices])

  const setField = (currency, field, value) =>
    setForm((f) => ({ ...f, [currency]: { ...f[currency], [field]: value } }))

  const handleSubmit = async () => {
    const payload = {}
    for (const currency of CURRENCIES) {
      const { amount, regularAmount } = form[currency]
      if (amount === '' || isNaN(amount)) {
        return toast.error(`Enter a valid ${currency} amount`)
      }
      payload[currency] = {
        // Stored as the smallest currency unit (paise/cents) — the form
        // itself is always in whole rupees/euros/dollars for readability.
        amount: Math.round(Number(amount) * 100),
        regularAmount:
          regularAmount === '' || regularAmount === null
            ? null
            : Math.round(Number(regularAmount) * 100),
      }
    }

    setSaving(true)
    try {
      await adminAPI.updatePricing(plan, payload)
      toast.success('Pricing updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save pricing')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${PLAN_NAMES[plan]?.name || plan} pricing`}
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
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Amounts are whole rupees/euros/dollars — e.g. enter{' '}
          <span className="text-gray-300">199</span> for ₹199, not 19900.
        </p>
        {CURRENCIES.map((currency) => (
          <div key={currency} className="grid grid-cols-2 gap-3">
            <Input
              label={`${currency} price`}
              type="number"
              placeholder="e.g. 199"
              value={form[currency].amount}
              onChange={(e) => setField(currency, 'amount', e.target.value)}
            />
            <Input
              label={`${currency} regular price (optional)`}
              type="number"
              placeholder="e.g. 399"
              value={form[currency].regularAmount}
              onChange={(e) => setField(currency, 'regularAmount', e.target.value)}
              hint="Struck-through 'after founders offer' price — leave empty for none"
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Main Pricing Page ──────────────────────────────────────────────────────

export const AdminPricing = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(null)

  const fetchPricing = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getPricing()
      setRows(res.data.data)
    } catch {
      toast.error('Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricing()
  }, [])

  const rowFor = (plan) => rows.find((r) => r.plan === plan)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-white text-2xl">Pricing</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            What each plan costs, per currency — shown on Pricing/Landing/Settings based on the
            visitor's detected region.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {['Plan', 'INR', 'EUR', 'USD', ''].map((h) => (
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
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="shimmer h-3 rounded w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                : PLANS.map((plan) => {
                    const row = rowFor(plan)
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
                        {CURRENCIES.map((currency) => (
                          <td key={currency} className="px-4 py-3.5">
                            {row?.prices?.[currency] ? (
                              <div>
                                <span className="text-sm text-gray-200">
                                  {formatPrice(row.prices[currency].amount, currency)}
                                </span>
                                {row.prices[currency].regularAmount && (
                                  <span className="text-2xs text-gray-600 ml-1.5 line-through">
                                    {formatPrice(row.prices[currency].regularAmount, currency)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600">—</span>
                            )}
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
        <IndianRupee size={11} />
        Razorpay only supports INR — EUR/USD checkouts go through Stripe (needs a Stripe account
        configured on the backend).
      </p>

      {/* Edit Modal */}
      {editPlan && (
        <PricingForm
          isOpen={!!editPlan}
          onClose={() => setEditPlan(null)}
          plan={editPlan}
          prices={rowFor(editPlan)?.prices}
          onSaved={fetchPricing}
        />
      )}
    </div>
  )
}
