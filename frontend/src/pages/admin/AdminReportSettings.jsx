// src/pages/admin/AdminReportSettings.jsx
import { useEffect, useState } from 'react'
import { Mail, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Input'
import adminAPI from '../../api/admin.api'

// Select values are always strings (native <select> onChange gives back a
// string regardless of the option's declared value) -- kept as strings in
// form state throughout and only converted to Number at submit time, so a
// re-render never mismatches a numeric initial value against a string one
// picked by the user.
const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

// 6:00 AM - 11:30 PM IST, 30-min steps. Early-morning hours are deliberately
// left out: picking the 1st-of-month + an hour before 5:30 AM IST would
// convert to a UTC day-of-month in the *previous* month, which a monthly
// cron pattern can't represent (not every month has a 29th/30th/31st, so
// that combination would silently skip some months). Report emails at 2 AM
// aren't a real use case anyway.
const TIME_OPTIONS = []
for (let h = 6; h <= 23; h++) {
  for (const m of [0, 30]) {
    const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    TIME_OPTIONS.push({ value: `${h}:${m}`, label, hour: h, minute: m })
  }
}

const ordinal = (n) => {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: ordinal(i + 1),
}))

const timeKey = (hour, minute) => `${hour}:${minute}`

const emptyForm = (s) => ({
  weeklyDayOfWeek: String(s?.weeklyDayOfWeek ?? 1),
  weeklyTime: timeKey(s?.weeklyHour ?? 13, s?.weeklyMinute ?? 30),
  monthlyDayOfMonth: String(s?.monthlyDayOfMonth ?? 1),
  monthlyTime: timeKey(s?.monthlyHour ?? 14, s?.monthlyMinute ?? 30),
  senderEmail: s?.senderEmail ?? 'hello@vezrin.com',
  senderName: s?.senderName ?? 'Vezrin Reports',
})

export const AdminReportSettings = () => {
  const [form, setForm] = useState(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await adminAPI.getReportSettings()
      setForm(emptyForm(res.data.data))
    } catch {
      toast.error('Failed to load report settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.senderEmail.trim()) return toast.error('Enter a sender email')

    const [weeklyHour, weeklyMinute] = form.weeklyTime.split(':').map(Number)
    const [monthlyHour, monthlyMinute] = form.monthlyTime.split(':').map(Number)

    setSaving(true)
    try {
      const res = await adminAPI.updateReportSettings({
        weeklyDayOfWeek: Number(form.weeklyDayOfWeek),
        weeklyHour,
        weeklyMinute,
        monthlyDayOfMonth: Number(form.monthlyDayOfMonth),
        monthlyHour,
        monthlyMinute,
        senderEmail: form.senderEmail.trim(),
        senderName: form.senderName.trim(),
      })
      setForm(emptyForm(res.data.data))
      toast.success('Report settings updated — takes effect immediately')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save report settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-5">
        <div className="shimmer h-8 w-64 rounded" />
        <div className="shimmer h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-white text-2xl">Report Emails</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          When weekly/monthly performance report emails go out, and who they're sent from. Times
          below are shown and entered in IST — converted to UTC internally, since that's what the
          server's scheduler actually runs on.
        </p>
      </div>

      <div className="glass p-6 rounded-2xl space-y-8">
        {/* Weekly */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Weekly report</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Day"
              name="weeklyDayOfWeek"
              value={form.weeklyDayOfWeek}
              onChange={(e) => set('weeklyDayOfWeek', e.target.value)}
              options={WEEKDAYS}
            />
            <Select
              label="Time (IST)"
              name="weeklyTime"
              value={form.weeklyTime}
              onChange={(e) => set('weeklyTime', e.target.value)}
              options={TIME_OPTIONS}
            />
          </div>
        </div>

        {/* Monthly */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Monthly report</h3>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Day of month"
              name="monthlyDayOfMonth"
              value={form.monthlyDayOfMonth}
              onChange={(e) => set('monthlyDayOfMonth', e.target.value)}
              options={DAYS_OF_MONTH}
            />
            <Select
              label="Time (IST)"
              name="monthlyTime"
              value={form.monthlyTime}
              onChange={(e) => set('monthlyTime', e.target.value)}
              options={TIME_OPTIONS}
            />
          </div>
          <p className="text-2xs text-gray-600 mt-2">
            Capped at the 28th so every month actually has that day.
          </p>
        </div>

        {/* Sender */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Sent from</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Sender email"
              type="email"
              value={form.senderEmail}
              onChange={(e) => set('senderEmail', e.target.value)}
              placeholder="hello@vezrin.com"
            />
            <Input
              label="Sender name"
              value={form.senderName}
              onChange={(e) => set('senderName', e.target.value)}
              placeholder="Vezrin Reports"
            />
          </div>
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl border border-amber/20 bg-amber/5">
            <Info size={14} className="text-amber shrink-0 mt-0.5" />
            <p className="text-2xs text-gray-400">
              This address must already be a verified sender in Brevo, or these emails will fail to
              send. Agency-plan creators with white-label branding still see their own company name
              here instead — this only sets the default.
            </p>
          </div>
        </div>

        <Button onClick={handleSubmit} loading={saving} icon={Mail}>
          Save Report Settings
        </Button>
      </div>

      <p className="text-2xs text-gray-600 mt-3">
        Saving reschedules the next send immediately — no redeploy needed.
      </p>
    </div>
  )
}
