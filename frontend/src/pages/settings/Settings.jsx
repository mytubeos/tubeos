// src/pages/settings/Settings.jsx
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  Lock,
  Bell,
  CreditCard,
  Check,
  Loader2,
  Palette,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Monitor,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import authApi from '../../api/auth.api'
import paymentAPI from '../../api/payment.api'
import pricingAPI from '../../api/pricing.api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Input, Select, Textarea } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/Modal'
import { Badge, PlanBadge } from '../../components/ui/Badge'
import { PLANS } from '../../utils/constants'
import { formatNumber, formatDate, isSubscriptionExpired } from '../../utils/formatters'
import { formatPrice } from '../../utils/currency'
import { useDodoCheckout } from '../../hooks/useDodoCheckout'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'password', label: 'Security', icon: Lock },
  { key: 'plan', label: 'Plan & Billing', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'help', label: 'Help & About', icon: HelpCircle },
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
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')
  const [mobileDetail, setMobileDetail] = useState(false)
  const { startDodoCheckout, loadingPlan, verifying } = useDodoCheckout({
    onSuccess: () => navigate('/dashboard'),
  })
  const [pricesByPlan, setPricesByPlan] = useState({})

  useEffect(() => {
    pricingAPI
      .getPrices()
      .then((res) => {
        const byPlan = {}
        for (const { plan, prices } of res.data.data || []) {
          byPlan[plan] = prices
        }
        setPricesByPlan(byPlan)
      })
      .catch(() => {})
  }, [])

  // Profile state
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [avatar, setAvatar] = useState(user?.avatar || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [timezone, setTimezone] = useState(
    user?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  )
  const timezones = [
    ...new Set([
      timezone,
      'UTC',
      ...(Intl.supportedValuesOf?.('timeZone') || [
        'Asia/Kolkata',
        'America/New_York',
        'Europe/London',
      ]),
    ]),
  ].sort()
  const [sessions, setSessions] = useState([])
  const [sessionsError, setSessionsError] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)
  const [confirmSessions, setConfirmSessions] = useState(false)
  const loadSessions = async () => {
    setLoadingSessions(true)
    setSessionsError('')
    try {
      const res = await authApi.getSessions()
      setSessions(res.data.data?.sessions || [])
    } catch {
      setSessionsError('Could not load devices. Please try again.')
    } finally {
      setLoadingSessions(false)
    }
  }
  useEffect(() => {
    if (activeTab === 'password') loadSessions()
  }, [activeTab])
  const signOutOthers = async () => {
    setSigningOutOthers(true)
    try {
      const res = await authApi.logoutOthers()
      localStorage.setItem('accessToken', res.data.data.accessToken)
      localStorage.setItem('refreshToken', res.data.data.refreshToken)
      useAuthStore.setState({ accessToken: res.data.data.accessToken })
      setConfirmSessions(false)
      toast.success('Other devices signed out')
      await loadSessions()
    } catch {
      toast.error('Could not complete sign-out. Please try again.')
    } finally {
      setSigningOutOthers(false)
    }
  }
  const choosePhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error('Choose a JPG, PNG or WebP photo up to 5 MB')
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 192
      canvas.height = 192
      const edge = Math.min(image.width, image.height)
      canvas
        .getContext('2d')
        .drawImage(
          image,
          (image.width - edge) / 2,
          (image.height - edge) / 2,
          edge,
          edge,
          0,
          0,
          192,
          192
        )
      setAvatar(canvas.toDataURL('image/webp', 0.8))
    } catch {
      toast.error('Could not read this photo')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  // Notifications state — seeded from user preferences (saved in DB)
  const [notifications, setNotifications] = useState({
    emailNotifications: user?.preferences?.emailNotifications ?? true,
    uploadAlerts: user?.preferences?.uploadAlerts ?? true,
    publishAlerts: user?.preferences?.publishAlerts ?? true,
    weeklyReport: user?.preferences?.weeklyReport ?? true,
    reportFrequency: user?.preferences?.reportFrequency || 'weekly',
    marketingEmails: user?.preferences?.marketingEmails ?? false,
    chingariEnabled: user?.preferences?.chingariEnabled ?? true,
  })
  const [savingNotifications, setSavingNotifications] = useState(false)

  // White-label branding state (Agency plan) — seeded from the user doc
  const [branding, setBranding] = useState({
    enabled: user?.branding?.enabled ?? false,
    companyName: user?.branding?.companyName || '',
    primaryColor: user?.branding?.primaryColor || '',
  })
  const [savingBranding, setSavingBranding] = useState(false)

  // Billing history + downgrade state
  const [billingHistory, setBillingHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false)
  const [downgrading, setDowngrading] = useState(false)

  useEffect(() => {
    if (activeTab !== 'plan') return
    setLoadingHistory(true)
    paymentAPI
      .getHistory(1, 10)
      .then((res) => setBillingHistory(res.data.data?.history || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [activeTab])

  const handleDowngrade = async () => {
    setDowngrading(true)
    try {
      await paymentAPI.downgradeToFree()
      updateUser({ plan: 'free', subscriptionExpiresAt: null })
      toast.success('Switched to Free plan')
      setShowDowngradeConfirm(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch plan')
    } finally {
      setDowngrading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSavingProfile(true)
    try {
      const profile = await authApi.updateMe({ name: name.trim(), avatar: avatar || null, bio })
      updateUser(profile.data.data)
      const prefs = await authApi.updatePreferences({ timezone })
      updateUser({ preferences: prefs.data.data.preferences })
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
      await logout()
      toast.success('Password changed. Sign in with your new password.')
      navigate('/login', { replace: true })
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
        uploadAlerts: notifications.uploadAlerts,
        publishAlerts: notifications.publishAlerts,
        weeklyReport: notifications.weeklyReport,
        reportFrequency: notifications.reportFrequency,
        marketingEmails: notifications.marketingEmails,
        chingariEnabled: notifications.chingariEnabled,
      })
      updateUser({ preferences: res.data.data?.preferences })
      toast.success('Preferences saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save preferences')
    } finally {
      setSavingNotifications(false)
    }
  }

  const handleSaveBranding = async () => {
    setSavingBranding(true)
    try {
      const res = await authApi.updateBranding({
        enabled: branding.enabled,
        companyName: branding.companyName,
        primaryColor: branding.primaryColor,
      })
      updateUser({ branding: res.data.data?.branding })
      toast.success('Branding saved!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branding')
    } finally {
      setSavingBranding(false)
    }
  }

  const plan = user?.plan || 'free'
  const planConfig = PLANS[plan]
  const usage = user?.usage || {}
  // Most recent history entry for the current plan — the real amount charged
  // (post-coupon), since billingHistory is sorted newest-first by the API.
  // Falls back to nothing for users who paid before this feature existed.
  const currentPlanPayment = billingHistory.find((h) => h.plan === plan)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {verifying && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 glass rounded-xl border border-brand/20">
          <Loader2 size={16} className="animate-spin text-brand" />
          <span className="text-sm text-gray-300">
            Confirming your payment — this takes a few seconds…
          </span>
        </div>
      )}

      <div className={`sm:hidden ${mobileDetail ? 'hidden' : 'block'}`}>
        <h2 className="font-display text-2xl text-white font-bold mb-2">Your workspace</h2>
        <p className="text-sm text-gray-400 mb-5">Manage your account, preferences and plan.</p>
      </div>
      {/* A full settings list on phones; compact navigation on larger screens. */}
      <div
        className={`${mobileDetail ? 'hidden sm:flex' : 'flex'} flex-col sm:flex-row sm:flex-wrap glass rounded-xl p-1 gap-1`}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key)
              setMobileDetail(true)
            }}
            className={`flex items-center gap-3 px-4 py-3 min-h-12 rounded-lg text-sm font-medium text-left
                        whitespace-nowrap transition-all
                        ${
                          activeTab === key
                            ? 'bg-brand text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
          >
            <Icon size={15} />
            {label}
            <ChevronRight size={16} className="sm:hidden ml-auto" />
          </button>
        ))}
      </div>

      <div className={`${mobileDetail ? 'block' : 'hidden sm:block'} space-y-5`}>
        <button
          type="button"
          className="sm:hidden flex items-center gap-2 min-h-11 text-sm text-gray-300"
          onClick={() => setMobileDetail(false)}
        >
          <ArrowLeft size={17} /> All settings
        </button>
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
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Profile"
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    user?.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white break-words">{user?.name}</p>
                  <p className="text-sm text-gray-400 break-all">{user?.email}</p>
                  <div className="mt-1">
                    <PlanBadge plan={plan} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="inline-flex items-center min-h-11 px-4 rounded-lg bg-white/5 text-sm text-gray-200 cursor-pointer">
                  Change photo
                  <input
                    aria-label="Profile photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={choosePhoto}
                    className="sr-only"
                  />
                </label>
                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="min-h-11 text-sm text-gray-400"
                  >
                    Remove photo
                  </button>
                )}
                <p className="text-xs text-gray-400">JPG, PNG or WebP · up to 5 MB</p>
              </div>
              <Input
                name="full-name"
                maxLength={50}
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

              <Textarea
                name="bio"
                label="About you"
                value={bio}
                maxLength={500}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about your creator journey"
              />
              <Select
                name="timezone"
                label="Display timezone"
                value={timezone}
                options={timezones.map((zone) => ({
                  value: zone,
                  label: zone.replaceAll('_', ' '),
                }))}
                onChange={(e) => setTimezone(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Dates and times display in this timezone. The schedule editor uses your device
                timezone and labels it separately.
              </p>
              <Button onClick={handleSaveProfile} loading={savingProfile}>
                Save Changes
              </Button>
            </div>
          </Card>
        )}

        {/* Password */}
        {activeTab === 'password' && (
          <div className="space-y-5">
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
                    name={`password-${key}`}
                    autoComplete={key === 'current' ? 'current-password' : 'new-password'}
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
            <Card>
              <CardHeader title="Your devices" icon={Monitor} />
              <p className="text-sm text-gray-400 mb-4">
                Devices are recorded when they sign in or refresh their session. Browser names may
                be approximate.
              </p>
              {loadingSessions ? (
                <p role="status" className="text-sm text-gray-300">
                  Loading devices…
                </p>
              ) : sessionsError ? (
                <div>
                  <p role="alert" className="text-sm text-rose">
                    {sessionsError}
                  </p>
                  <Button variant="ghost" size="sm" onClick={loadSessions}>
                    Retry
                  </Button>
                </div>
              ) : sessions.length ? (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="glass p-3 rounded-xl">
                      <p className="text-sm text-white break-words">
                        {session.device}{' '}
                        {session.current && (
                          <span className="text-emerald text-xs">· This device</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Last sign-in or refresh: {formatDate(session.lastSeenAt, 'datetime')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Device history will appear after your next sign-in or session refresh.
                </p>
              )}
              <Button
                variant="ghost"
                className="mt-4"
                icon={ShieldCheck}
                onClick={() => setConfirmSessions(true)}
              >
                Sign out other devices
              </Button>
            </Card>
          </div>
        )}

        {/* Plan & Billing */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Current Plan" icon={CreditCard} />
              <div className="flex items-center justify-between p-4 glass rounded-xl mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-display font-bold text-white text-xl">
                      {PLANS[plan]?.name || plan} Plan
                    </p>
                    <PlanBadge plan={plan} />
                  </div>
                  <p className="text-sm text-gray-400">
                    {plan === 'free' ? (
                      'Free forever'
                    ) : currentPlanPayment &&
                      currentPlanPayment.amount !== currentPlanPayment.originalAmount ? (
                      <>
                        <span className="line-through text-gray-400 mr-1.5">
                          {formatPrice(
                            currentPlanPayment.originalAmount,
                            currentPlanPayment.currency || 'USD'
                          )}
                        </span>
                        {formatPrice(
                          currentPlanPayment.amount,
                          currentPlanPayment.currency || 'USD'
                        )}
                        /month
                      </>
                    ) : currentPlanPayment ? (
                      `${formatPrice(currentPlanPayment.amount, currentPlanPayment.currency || 'USD')}/month`
                    ) : pricesByPlan[plan]?.USD ? (
                      `${formatPrice(pricesByPlan[plan].USD.amount, 'USD')}/month`
                    ) : (
                      ''
                    )}
                  </p>
                  {plan !== 'free' &&
                    user?.subscriptionExpiresAt &&
                    // Billing here is a manual monthly top-up, not an auto-charge
                    // subscription (see payment.service.js) -- nothing actually
                    // "renews" on this date, and nothing downgrades the account
                    // when it passes either. Once it's in the past, say so
                    // plainly instead of "Renews on <past date>", which reads as
                    // broken and implies an auto-renewal that never happens.
                    (isSubscriptionExpired(user.subscriptionExpiresAt) ? (
                      <p className="text-2xs text-rose mt-0.5">
                        Expired on {formatDate(user.subscriptionExpiresAt, 'medium')} — pay again to
                        keep {plan} features
                      </p>
                    ) : (
                      <p className="text-2xs text-gray-400 mt-0.5">
                        Access until {formatDate(user.subscriptionExpiresAt, 'medium')}
                      </p>
                    ))}
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

              {plan !== 'free' && (
                <button
                  onClick={() => setShowDowngradeConfirm(true)}
                  className="w-full text-center text-2xs text-gray-400 hover:text-rose transition-colors mt-4"
                >
                  Switch to Free plan
                </button>
              )}
            </Card>

            {/* White-label reports */}
            <Card>
              <CardHeader
                title="White-Label Reports"
                subtitle={plan === 'agency' ? 'Your brand on every export & email' : 'Max feature'}
                icon={Palette}
                iconColor={plan === 'agency' ? 'brand' : 'gray'}
              />
              {plan !== 'agency' ? (
                <div className="text-center py-8">
                  <Palette size={32} className="mx-auto mb-3 text-gray-700" />
                  <p className="text-sm text-gray-400 mb-3">
                    Send analytics reports and CSV/PDF exports under your own company name and color
                    instead of Vezrin's.
                  </p>
                  <Badge variant="cyan">Upgrade to Max to unlock</Badge>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-300">Enable white-labeling</p>
                      <p className="text-xs text-gray-400">
                        Replaces "Vezrin" branding on your reports and report emails
                      </p>
                    </div>
                    <button
                      onClick={() => setBranding((p) => ({ ...p, enabled: !p.enabled }))}
                      className={`w-10 h-6 rounded-full transition-all relative shrink-0
                                ${branding.enabled ? 'bg-brand' : 'bg-white/10'}`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                                      ${branding.enabled ? 'left-5' : 'left-1'}`}
                      />
                    </button>
                  </div>
                  <Input
                    label="Company Name"
                    placeholder="Your Agency Name"
                    maxLength={60}
                    value={branding.companyName}
                    onChange={(e) => setBranding((p) => ({ ...p, companyName: e.target.value }))}
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                      Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.primaryColor || '#00A0FD'}
                        onChange={(e) =>
                          setBranding((p) => ({ ...p, primaryColor: e.target.value }))
                        }
                        className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                      />
                      <span className="text-xs text-gray-400">
                        Used in place of Vezrin's blue on report headers
                      </span>
                    </div>
                  </div>
                  <Button onClick={handleSaveBranding} loading={savingBranding} size="sm">
                    Save Branding
                  </Button>
                </div>
              )}
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
                          <p className="font-display font-bold text-white">{config.name}</p>
                          {key === 'pro' && (
                            <span className="text-2xs text-brand bg-brand/15 px-2 py-0.5 rounded-full">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-display font-bold text-white mb-1">
                          {pricesByPlan[key]?.USD
                            ? formatPrice(pricesByPlan[key].USD.amount, 'USD')
                            : '—'}
                          <span className="text-sm text-gray-400 font-normal">/mo</span>
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
                        <Button
                          size="sm"
                          fullWidth
                          className="mt-4"
                          variant={key === 'pro' ? 'brand' : 'ghost'}
                          disabled={loadingPlan === key}
                          onClick={() => startDodoCheckout(key)}
                        >
                          {loadingPlan === key ? (
                            <Loader2 size={14} className="animate-spin mx-auto" />
                          ) : (
                            'Upgrade'
                          )}
                        </Button>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* Billing History */}
            <Card>
              <CardHeader title="Billing History" icon={CreditCard} />
              {loadingHistory ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="shimmer h-14 rounded-xl" />
                  ))}
                </div>
              ) : billingHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No payments yet.</p>
              ) : (
                <div className="space-y-2">
                  {billingHistory.map((h) => (
                    <div
                      key={h._id}
                      className="flex items-center justify-between p-3 glass rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">
                          {PLANS[h.plan]?.name || h.plan} Plan
                        </p>
                        <p className="text-2xs text-gray-400">
                          {formatDate(h.createdAt, 'medium')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {formatPrice(h.amount, h.currency || 'USD')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        <ConfirmModal
          isOpen={showDowngradeConfirm}
          onClose={() => setShowDowngradeConfirm(false)}
          onConfirm={handleDowngrade}
          title="Switch to Free plan?"
          message="You'll lose access to paid features immediately — this can't be undone, and you'll need to purchase a plan again to upgrade."
          confirmLabel="Switch to Free"
          confirmVariant="danger"
          loading={downgrading}
        />

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
                    desc: 'Receive all transactional emails from Vezrin',
                  },
                  {
                    key: 'marketingEmails',
                    label: 'Product Updates & Tips',
                    desc: 'New features, creator tips, and platform news',
                  },
                  {
                    key: 'uploadAlerts',
                    label: 'Upload failures',
                    desc: 'In-app alerts when a video upload fails',
                  },
                  {
                    key: 'publishAlerts',
                    label: 'Published videos',
                    desc: 'In-app alerts when a video is marked published',
                  },
                  {
                    key: 'chingariEnabled',
                    label: 'Chingari Nudges',
                    desc: 'In-app reminders and streak celebrations from your mascot',
                  },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                    </div>
                    <button
                      role="switch"
                      aria-label={label}
                      aria-checked={notifications[key]}
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
              <p className="text-xs text-gray-400 mb-4">
                A personalised email every Monday with your channel's KPIs, top videos, AI insights,
                and action plan.
              </p>

              {/* Toggle row */}
              <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">Enable Weekly Report</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sent every Monday at 9 AM UTC</p>
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
                <div className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">Report Frequency</p>
                    <p className="text-xs text-gray-400 mt-0.5">How often you receive the report</p>
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
                    <p className="text-2xs text-gray-400 mt-1 leading-relaxed">
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

        {activeTab === 'help' && (
          <Card>
            <CardHeader title="Help & About" icon={HelpCircle} />
            <div className="space-y-4 text-sm text-gray-300">
              <p>Vezrin · Creator Command Center</p>
              <p className="text-gray-400">Web version {__APP_VERSION__}</p>
              <a
                href="mailto:hello@vezrin.com?subject=Vezrin%20Support"
                className="flex items-center justify-between min-h-12 glass px-4 rounded-xl"
              >
                Contact support <ChevronRight size={16} />
              </a>
              <a
                href="mailto:hello@vezrin.com?subject=Vezrin%20Bug%20Report&body=Screen%3A%20%0ASteps%3A%20%0AExpected%3A%20%0AWhat%20happened%3A%20%0ADevice%3A%20"
                className="flex items-center justify-between min-h-12 glass px-4 rounded-xl"
              >
                Report a problem <ChevronRight size={16} />
              </a>
              <p className="text-xs text-gray-400">
                Include the screen name and steps so we can reproduce the issue.
              </p>
            </div>
          </Card>
        )}
      </div>
      <ConfirmModal
        isOpen={confirmSessions}
        onClose={() => setConfirmSessions(false)}
        onConfirm={signOutOthers}
        loading={signingOutOthers}
        title="Sign out other devices?"
        message="Other devices will need to sign in again. You will stay signed in here."
        confirmLabel="Sign out other devices"
      />
      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-400">
        <Link to="/privacy" className="hover:text-gray-400 transition-colors">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-gray-400 transition-colors">
          Terms of Service
        </Link>
      </div>
    </div>
  )
}
