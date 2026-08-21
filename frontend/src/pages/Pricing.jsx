// src/pages/Pricing.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, Zap, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import pricingAPI from '../api/pricing.api'
import { useAuthStore } from '../store/authStore'
import { useDodoCheckout } from '../hooks/useDodoCheckout'
import { PLANS as PLAN_NAMES } from '../utils/constants'
import { formatPrice } from '../utils/currency'

const FEATURES_TABLE = [
  {
    category: 'Analytics',
    features: [
      { name: 'Basic views & likes graph', free: true, creator: true, pro: true, agency: true },
      { name: 'Day-wise performance', free: false, creator: true, pro: true, agency: true },
      { name: 'Per video breakdown', free: false, creator: true, pro: true, agency: true },
      { name: 'Traffic sources', free: false, creator: true, pro: true, agency: true },
    ],
  },
  {
    category: 'Time Intelligence',
    features: [
      { name: '7×24 Heatmap', free: false, creator: true, pro: true, agency: true },
      { name: 'Best time to post', free: false, creator: true, pro: true, agency: true },
      { name: 'Low traffic detection', free: false, creator: true, pro: true, agency: true },
    ],
  },
  {
    category: 'Scheduling',
    features: [
      { name: 'Manual scheduling', free: false, creator: true, pro: true, agency: true },
      { name: 'AI time suggestions', free: false, creator: true, pro: true, agency: true },
      { name: 'Bulk scheduling', free: false, creator: false, pro: true, agency: true },
      { name: 'Auto-post mode', free: false, creator: true, pro: true, agency: true },
    ],
  },
  {
    category: 'AI Features',
    features: [
      { name: 'AI comment replies/mo', free: '10', creator: '500', pro: '1200', agency: '∞' },
      { name: 'Bulk AI replies', free: false, creator: false, pro: true, agency: true },
      { name: 'Auto-reply mode', free: false, creator: false, pro: true, agency: true },
      {
        name: 'Titles, Tags, Descriptions, SEO & Scripts',
        free: '20/mo',
        creator: '500/mo',
        pro: '2000/mo',
        agency: '∞',
      },
      { name: 'Thumbnail Ideas', free: '5/mo', creator: '5/mo', pro: '15/mo', agency: '50/mo' },
      { name: 'Content Niche Ideas', free: true, creator: true, pro: true, agency: true },
    ],
  },
  {
    category: 'Reports',
    features: [
      { name: 'Daily reports', free: false, creator: '30/mo', pro: '30/mo', agency: '∞' },
      { name: 'Weekly reports', free: false, creator: '4/mo', pro: '4/mo', agency: '∞' },
      { name: 'White label reports', free: false, creator: false, pro: false, agency: true },
    ],
  },
  {
    category: 'Growth',
    features: [
      { name: 'Growth prediction', free: false, creator: true, pro: true, agency: true },
      { name: 'Performance suggestions', free: false, creator: true, pro: true, agency: true },
      { name: 'Competitor tracker', free: false, creator: false, pro: '3 channels', agency: true },
      { name: 'Trend scanner', free: false, creator: false, pro: true, agency: true },
    ],
  },
  {
    category: 'Shorts + Live',
    features: [
      { name: 'Shorts analytics', free: false, creator: true, pro: true, agency: true },
      { name: 'Shorts script', free: false, creator: true, pro: true, agency: true },
      { name: 'Long video → Shorts', free: false, creator: false, pro: true, agency: true },
    ],
  },
  {
    category: 'Platform',
    features: [
      { name: 'Channels', free: '1', creator: '1', pro: '3', agency: '25' },
      { name: 'Video uploads/month', free: '0', creator: '5', pro: '20', agency: '∞' },
    ],
  },
]

const CellValue = ({ value }) => {
  if (value === true) return <Check size={16} className="text-emerald mx-auto" />
  if (value === false) return <X size={14} className="text-gray-700 mx-auto" />
  return <span className="text-sm text-gray-300 font-medium">{value}</span>
}

export const Pricing = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [pricesByPlan, setPricesByPlan] = useState({})
  const { startDodoCheckout, loadingPlan, verifying } = useDodoCheckout({
    onSuccess: () => navigate('/dashboard'),
  })

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

  const plans = ['free', 'creator', 'pro', 'agency']
  const planColors = { free: 'gray', creator: 'brand', pro: 'cyan', agency: 'rose' }

  // Free has no PlanPrice row (it's always 0); everything else comes from
  // the admin-editable pricing fetched above. USD-only — Vezrin charges the
  // same price worldwide via Dodo Payments (Merchant of Record).
  const getPlanDisplay = (plan) => {
    if (plan === 'free') return { price: formatPrice(0, 'USD'), note: 'Free forever' }
    const p = pricesByPlan[plan]?.USD
    if (!p) return { price: '—', note: '' }
    return {
      price: formatPrice(p.amount, 'USD'),
      note: p.regularAmount ? `→ ${formatPrice(p.regularAmount, 'USD')}/mo` : '',
    }
  }

  const handleUpgradeClick = (plan) => {
    if (plan === 'free') {
      navigate('/signup')
      return
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { redirectTo: '/pricing', selectedPlan: plan } })
      return
    }
    if (user?.plan === plan) {
      toast("You're already on this plan.")
      return
    }
    startDodoCheckout(plan)
  }

  return (
    <div className="min-h-screen bg-base-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-base-900/80 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-gradient rounded-md flex items-center justify-center">
                <Zap size={13} className="text-white" />
              </div>
              <span className="font-display font-bold text-white">Vezrin</span>
            </div>
          </button>
          <Button size="sm" onClick={() => navigate('/signup')}>
            Get Started
          </Button>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-5">
        <div className="max-w-7xl mx-auto">
          {verifying && (
            <div className="mb-8 flex items-center justify-center gap-2 px-4 py-3 glass rounded-xl border border-brand/20">
              <Loader2 size={16} className="animate-spin text-brand" />
              <span className="text-sm text-gray-300">
                Confirming your payment — this takes a few seconds…
              </span>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-display font-bold text-white text-5xl mb-4">Pricing</h1>
            <p className="text-gray-500 text-lg">
              Lock in founders pricing — increases as spots fill up.
            </p>
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 glass rounded-full border border-emerald/20">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              <span className="text-sm text-gray-300">
                Founders offer active — <span className="text-emerald">88 Creator spots left</span>
              </span>
            </div>
          </div>

          {/* Mobile: stacked plan cards (grid-cols-5 comparison table is unusable under ~640px) */}
          <div className="md:hidden space-y-5">
            {plans.map((plan) => (
              <div
                key={plan}
                className={`rounded-2xl p-5 ${plan === 'creator' ? 'bg-brand/10 border border-brand/30' : 'glass'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-display font-bold text-white text-lg">
                    {PLAN_NAMES[plan]?.name || plan}
                  </p>
                  <p className={`text-2xl font-display font-bold text-${planColors[plan]}`}>
                    {getPlanDisplay(plan).price}
                    <span className="text-sm text-gray-500 font-normal">/mo</span>
                  </p>
                </div>
                <p className="text-xs text-gray-600 mb-4">{getPlanDisplay(plan).note}</p>

                {user?.plan === plan ? (
                  <div className="w-full py-2 text-sm text-center text-emerald font-semibold">
                    Current Plan
                  </div>
                ) : plan === 'free' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() => navigate('/signup')}
                  >
                    Get Free
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={plan === 'creator' ? 'brand' : 'ghost'}
                    className="w-full"
                    disabled={loadingPlan === plan}
                    onClick={() => handleUpgradeClick(plan)}
                  >
                    {loadingPlan === plan ? (
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                )}

                {/* What's included — only the features this plan actually has */}
                <div className="mt-5 pt-4 border-t border-white/8 space-y-3">
                  {FEATURES_TABLE.map(({ category, features }) => {
                    const included = features.filter((f) => f[plan] !== false)
                    if (included.length === 0) return null
                    return (
                      <div key={category}>
                        <p className="text-2xs font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                          {category}
                        </p>
                        <ul className="space-y-1.5">
                          {included.map((f) => (
                            <li
                              key={f.name}
                              className="flex items-center gap-2 text-sm text-gray-300"
                            >
                              <Check size={13} className="text-emerald shrink-0" />
                              <span>
                                {f.name}
                                {typeof f[plan] === 'string' && (
                                  <span className="text-gray-500"> — {f[plan]}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: full comparison table */}
          <div className="hidden md:block">
            {/* Plan headers */}
            <div
              className="grid grid-cols-5 gap-4 mb-2 sticky top-16 z-10
                          bg-base-900/95 backdrop-blur-sm py-4 -mx-5 px-5"
            >
              <div /> {/* Feature column */}
              {plans.map((plan) => (
                <div
                  key={plan}
                  className={`p-4 rounded-xl text-center
                            ${plan === 'creator' ? 'bg-brand/10 border border-brand/30' : 'glass'}`}
                >
                  <p className="font-display font-bold text-white mb-1">
                    {PLAN_NAMES[plan]?.name || plan}
                  </p>
                  <p className={`text-2xl font-display font-bold text-${planColors[plan]}`}>
                    {getPlanDisplay(plan).price}
                    <span className="text-sm text-gray-500 font-normal">/mo</span>
                  </p>
                  <p className="text-2xs text-gray-600 mt-0.5">{getPlanDisplay(plan).note}</p>

                  {user?.plan === plan ? (
                    <div className="mt-3 w-full py-1.5 text-xs text-center text-emerald font-semibold">
                      Current Plan
                    </div>
                  ) : plan === 'free' ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="mt-3 w-full"
                      onClick={() => navigate('/signup')}
                    >
                      Get Free
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant={plan === 'creator' ? 'brand' : 'ghost'}
                      className="mt-3 w-full"
                      disabled={loadingPlan === plan}
                      onClick={() => handleUpgradeClick(plan)}
                    >
                      {loadingPlan === plan ? (
                        <Loader2 size={14} className="animate-spin mx-auto" />
                      ) : (
                        'Upgrade'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Feature table */}
            <div className="space-y-6">
              {FEATURES_TABLE.map(({ category, features }) => (
                <div key={category}>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="col-span-5 pt-4 pb-2 border-b border-white/8">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                        {category}
                      </p>
                    </div>
                  </div>

                  {features.map(({ name, free, creator, pro, agency }) => (
                    <div
                      key={name}
                      className="grid grid-cols-5 gap-4 py-3 border-b border-white/[0.04]
                               hover:bg-white/[0.02] transition-colors -mx-2 px-2 rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="text-sm text-gray-400">{name}</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <CellValue value={free} />
                      </div>
                      <div className="flex items-center justify-center">
                        <CellValue value={creator} />
                      </div>
                      <div className="flex items-center justify-center">
                        <CellValue value={pro} />
                      </div>
                      <div className="flex items-center justify-center">
                        <CellValue value={agency} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16 pt-8 border-t border-white/8">
            <p className="text-gray-400 mb-4">
              All plans include a 14-day free trial. No credit card required.
            </p>
            <Button size="lg" onClick={() => navigate('/signup')}>
              Start Free Today
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
