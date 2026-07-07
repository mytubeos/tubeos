// src/pages/settings/Settings.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Bell, CreditCard, Check, Loader2, Tag, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import authApi from '../../api/auth.api'
import paymentAPI from '../../api/payment.api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PlanBadge } from '../../components/ui/Badge'
import { PLANS } from '../../utils/constants'
import { formatNumber } from '../../utils/formatters'
import { useRazorpay } from '../../hooks/useRazorpay'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'password', label: 'Password', icon: Lock },
  { key: 'plan', label: 'Plan & Billing', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

const UsageBar = ({ label, used, limit }) => {
  const isUnlimited = limit === -1
  const isUnavailable = limit === 0
  const pct = isUnlimited || isUnavailable ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const isHigh = pct >= 80

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-xs font-medium ${isHigh ? 'text-rose' : 'text-gray-400'}`}>
          {isUnlimited
            ? '∞ Unlimited'
            : isUnavailable
              ? 'Not available'
              : `${formatNumber(used)} / ${formatNumber(limit)}`}
        </span>
      </div>
      {!isUnlimited && !isUnavailable && (
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500
                        ${isHigh ? 'bg-rose' : 'bg-brand-gradient'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export const Settings = () => {
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')
  const { startCheckout, loadingPlan } = useRazorpay({
    onSuccess: () => navigate('/dashboard'),
  })

  // Coupon state for the in-app upgrade cards (keyed by which plan's box is open)
  const [coupon, setCoupon] = useState({ plan: null, code: '', validating: false, result: null })

  const openCoupon = (planKey) =>
    setCoupon({ plan: planKey, code: '', validating: false, result: null })
  const closeCoupon = () => setCoupon({ plan: null, code: '', validating: false, result: null })

  const applyCoupon = async (planKey) => {
    if (!coupon.code.trim()) return
    setCoupon((s) => ({ ...s, validating: true, result: null }))
    try {
      const res = await paymentAPI.validateCoupon(coupon.code.trim(), planKey)
      setCoupon((s) => ({ ...s, validating: false, result: res.data.data }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid coupon')
      setCoupon((s) => ({ ...s, validating: false, result: null }))
    }
  }

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  // Notifications state — seeded from user preferences (saved in DB)
  const [notifications, setNotifications] = useState({
    emailNotifications: user?.preferences?.emailNotifications ?? true,
    weeklyReport: user?.preferences?.weeklyReport ?? true,
    reportFrequency: user?.preferences?.reportFrequency || 'weekly',
    marketingEmails: user?.preferences?.marketingEmails ?? false,
  })
  const [savingNotifications, setSavingNotifications] = useState(false)

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSavingProfile(true)
    try {
      await authApi.updateMe({ name })
      updateUser({ name })
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new) {
      toast.error('Fill all fields')
      return
    }
    if (passwords.new.length < 8) {
      toast.error('New password min 8 characters')
      return
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword(passwords.current, passwords.new)
      setPasswords({ current: '', new: '', confirm: '' })
      toast.success('Password changed!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSavingNotifications(true)
    try {
      const res = await authApi.updatePreferences({
        emailNotifications: notifications.emailNotifications,
        weeklyReport: notifications.weeklyReport,
        reportFrequency: notifications.reportFrequency,
        marketingEmails: notifications.marketingEmails,
      })
      updateUser({ preferences: res.data.data?.preferences })
      toast.success('Preferences saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save preferences')
    } finally {
      setSavingNotifications(false)
    }
  }

  const plan = user?.plan || 'free'
  const planConfig = PLANS[plan]
  const usage = user?.usage || {}

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Tab nav */}
      <div className="flex items-center glass rounded-xl p-1 overflow-x-auto no-scrollbar">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        whitespace-nowrap transition-all
                        ${
                          activeTab === key
                            ? 'bg-brand text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader title="Profile Settings" icon={User} />
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 glass rounded-xl mb-2">
              <div
                className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center
                              text-white font-bold text-xl font-display shrink-0"
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white">{user?.name}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <div className="mt-1">
                  <PlanBadge plan={plan} />
                </div>
              </div>
            </div>

            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Email"
              value={user?.email || ''}
              disabled
              hint="Email cannot be changed"
            />

            <Button onClick={handleSaveProfile} loading={savingProfile}>
              Save Changes
            </Button>
          </div>
        </Card>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <Card>
          <CardHeader title="Change Password" icon={Lock} />
          <div className="space-y-4">
            {[
              { key: 'current', label: 'Current Password' },
              { key: 'new', label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <Input
                key={key}
                label={label}
                type="password"
                value={passwords[key]}
                onChange={(e) => setPasswords((p) => ({ ...p, [key]: e.target.value }))}
                placeholder="••••••••"
              />
            ))}
            <Button onClick={handleChangePassword} loading={savingPassword}>
              Change Password
            </Button>
          </div>
        </Card>
      )}

      {/* Plan & Billing */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Current Plan" icon={CreditCard} />
            <div className="flex items-center justify-between p-4 glass rounded-xl mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display font-bold text-white text-xl capitalize">
                    {plan} Plan
                  </p>
                  <PlanBadge plan={plan} />
                </div>
                <p className="text-sm text-gray-500">
                  {plan === 'free' ? 'Free forever' : `₹${planConfig?.price?.inr}/month`}
                </p>
              </div>
              {plan !== 'agency' && (
                <Button size="sm" onClick={() => navigate('/pricing')}>
                  Upgrade
                </Button>
              )}
            </div>

            {/* Usage bars */}
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                This Month's Usage
              </p>
              <UsageBar
                label="AI Replies"
                used={usage.aiRepliesUsed || 0}
                limit={planConfig?.aiReplies || 0}
              />
              <UsageBar
                label="Video Uploads"
                used={usage.uploadsUsed || 0}
                limit={planConfig?.uploads === 0 ? 0 : planConfig?.uploads || 0}
              />
            </div>
          </Card>

          {/* Upgrade CTA */}
          {plan !== 'agency' && (
            <Card>
              <CardHeader title="Upgrade Your Plan" icon={CreditCard} iconColor="amber" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Object.entries(PLANS)
                  .filter(([key]) => key !== 'free' && key !== plan)
                  .map(([key, config]) => (
                    <div
                      key={key}
                      className={`p-4 rounded-xl border transition-all cursor-pointer
                                  ${
                                    key === 'pro'
                                      ? 'border-brand/40 bg-brand/5'
                                      : 'glass hover:border-white/20'
                                  }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-display font-bold text-white capitalize">{key}</p>
                        {key === 'pro' && (
                          <span className="text-2xs text-brand bg-brand/15 px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-display font-bold text-white mb-1">
                        ₹{config.price.inr}
                        <span className="text-sm text-gray-500 font-normal">/mo</span>
                      </p>
                      <div className="space-y-1.5 mt-3">
                        {[
                          `${config.channels} channel${config.channels > 1 ? 's' : ''}`,
                          `${config.aiReplies === -1 ? 'Unlimited' : config.aiReplies} AI replies`,
                          `${config.uploads === -1 ? 'Unlimited' : config.uploads} uploads/mo`,
                        ].map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-gray-400">
                            <Check size={11} className="text-emerald" />
                            {f}
                          </div>
                        ))}
                      </div>
                      {/* Coupon box */}
                      {coupon.plan === key ? (
                        <div className="mt-4 space-y-2">
                          <div className="flex gap-1">
                            <input
                              className="input-field h-8 text-xs px-2 flex-1 uppercase"
                              placeholder="COUPON CODE"
                              value={coupon.code}
                              onChange={(e) =>
                                setCoupon((s) => ({
                                  ...s,
                                  code: e.target.value.toUpperCase(),
                                  result: null,
                                }))
                              }
                              onKeyDown={(e) => e.key === 'Enter' && applyCoupon(key)}
                            />
                            <button
                              onClick={() => applyCoupon(key)}
                              disabled={coupon.validating}
                              className="px-2 h-8 bg-brand/20 border border-brand/30 rounded-lg text-brand text-xs
                                         hover:bg-brand/30 transition-colors disabled:opacity-50"
                            >
                              {coupon.validating ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                'Apply'
                              )}
                            </button>
                            <button
                              onClick={closeCoupon}
                              className="p-1.5 h-8 glass border border-white/10 rounded-lg text-gray-500 hover:text-white"
                            >
                              <X size={11} />
                            </button>
                          </div>

                          {coupon.result && (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald/10 border border-emerald/20 rounded-lg">
                              <Check size={11} className="text-emerald shrink-0" />
                              <span className="text-2xs text-emerald">
                                ₹{coupon.result.originalPrice} → ₹{coupon.result.discountedPrice}
                              </span>
                            </div>
                          )}

                          <Button
                            size="sm"
                            fullWidth
                            variant={key === 'pro' ? 'brand' : 'ghost'}
                            disabled={loadingPlan === key}
                            onClick={() => startCheckout(key, coupon.code.trim() || null)}
                          >
                            {loadingPlan === key ? (
                              <Loader2 size={14} className="animate-spin mx-auto" />
                            ) : (
                              'Upgrade'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            fullWidth
                            className="mt-4"
                            variant={key === 'pro' ? 'brand' : 'ghost'}
                            disabled={loadingPlan === key}
                            onClick={() => startCheckout(key)}
                          >
                            {loadingPlan === key ? (
                              <Loader2 size={14} className="animate-spin mx-auto" />
                            ) : (
                              'Upgrade'
                            )}
                          </Button>
                          <button
                            onClick={() => openCoupon(key)}
                            className="flex items-center justify-center gap-1 w-full text-2xs text-gray-600
                                       hover:text-gray-400 transition-colors py-1 mt-1.5"
                          >
                            <Tag size={10} /> Have a coupon?
                          </button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {/* Email toggles */}
          <Card>
            <CardHeader title="Email Preferences" icon={Bell} />
            <div className="space-y-1">
              {[
                {
                  key: 'emailNotifications',
                  label: 'Email Notifications',
                  desc: 'Receive all transactional emails from TubeOS',
                },
                {
                  key: 'marketingEmails',
                  label: 'Product Updates & Tips',
                  desc: 'New features, creator tips, and platform news',
                },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))}
                    className={`w-11 h-6 rounded-full transition-all relative shrink-0
                                ${notifications[key] ? 'bg-brand' : 'bg-white/10'}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                                      ${notifications[key] ? 'left-6' : 'left-1'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Weekly Report card */}
          <Card>
            <CardHeader title="Weekly Performance Report" icon={Bell} iconColor="brand" />
            <p className="text-xs text-gray-500 mb-4">
              A personalised email every Monday with your channel's KPIs, top videos, AI insights,
              and action plan.
            </p>

            {/* Toggle row */}
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-medium text-white">Enable Weekly Report</p>
                <p className="text-xs text-gray-500 mt-0.5">Sent every Monday at 9 AM UTC</p>
              </div>
              <button
                onClick={() => setNotifications((p) => ({ ...p, weeklyReport: !p.weeklyReport }))}
                className={`w-11 h-6 rounded-full transition-all relative shrink-0
                            ${notifications.weeklyReport ? 'bg-brand' : 'bg-white/10'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                                  ${notifications.weeklyReport ? 'left-6' : 'left-1'}`}
                />
              </button>
            </div>

            {/* Frequency selector — shown only when enabled */}
            {notifications.weeklyReport && (
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-white">Report Frequency</p>
                  <p className="text-xs text-gray-500 mt-0.5">How often you receive the report</p>
                </div>
                <div className="flex gap-2">
                  {['weekly', 'monthly'].map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setNotifications((p) => ({ ...p, reportFrequency: freq }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
                                  ${
                                    notifications.reportFrequency === freq
                                      ? 'bg-brand text-white'
                                      : 'glass text-gray-400 hover:text-white'
                                  }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview chip */}
            {notifications.weeklyReport && (
              <div className="mt-2 p-3 glass rounded-xl border border-brand/20 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bell size={14} className="text-brand" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">What's included</p>
                  <p className="text-2xs text-gray-500 mt-1 leading-relaxed">
                    Views · Watch Time · Subscribers · CTR · 7-day bar chart · Top 3 videos · AI
                    insights · Best posting times · Milestones · 4-item action plan
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveNotifications}
              loading={savingNotifications}
              className="mt-4"
            >
              Save Preferences
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
