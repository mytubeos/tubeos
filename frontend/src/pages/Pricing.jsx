// src/pages/Pricing.jsx
import { useNavigate } from 'react-router-dom'
import { Check, X, Zap, ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/Button'

const FEATURES_TABLE = [
  { category: 'Analytics', features: [
    { name: 'Basic views & likes graph', free: true, creator: true, pro: true, agency: true },
    { name: 'Day-wise performance', free: false, creator: true, pro: true, agency: true },
    { name: 'Per video breakdown', free: false, creator: true, pro: true, agency: true },
    { name: 'Traffic sources', free: false, creator: true, pro: true, agency: true },
    { name: 'Real-time traffic', free: false, creator: false, pro: true, agency: true },
  ]},
  { category: 'Time Intelligence', features: [
    { name: '7×24 Heatmap', free: false, creator: true, pro: true, agency: true },
    { name: 'Best time to post', free: false, creator: true, pro: true, agency: true },
    { name: 'Low traffic detection', free: false, creator: true, pro: true, agency: true },
  ]},
  { category: 'Scheduling', features: [
    { name: 'Manual scheduling', free: false, creator: true, pro: true, agency: true },
    { name: 'AI time suggestions', free: false, creator: true, pro: true, agency: true },
    { name: 'Bulk scheduling', free: false, creator: false, pro: true, agency: true },
    { name: 'Auto-post mode', free: false, creator: true, pro: true, agency: true },
  ]},
  { category: 'AI Features', features: [
    { name: 'AI comment replies/mo', free: '0', creator: '500', pro: '1200', agency: '∞' },
    { name: 'Bulk AI replies', free: false, creator: false, pro: true, agency: true },
    { name: 'Auto-reply mode', free: false, creator: false, pro: true, agency: true },
    { name: 'Titles + Descriptions', free: false, creator: '20/mo', pro: '50/mo', agency: '∞' },
    { name: 'Video Scripts', free: false, creator: '30/mo', pro: '60/mo', agency: '∞' },
    { name: 'Thumbnail Ideas', free: false, creator: '50/mo', pro: '100/mo', agency: '∞' },
    { name: 'Content Niche Ideas', free: false, creator: false, pro: true, agency: true },
  ]},
  { category: 'Reports', features: [
    { name: 'Daily reports', free: false, creator: '30/mo', pro: '30/mo', agency: '∞' },
    { name: 'Weekly reports', free: false, creator: '4/mo', pro: '4/mo', agency: '∞' },
    { name: 'White label reports', free: false, creator: false, pro: false, agency: true },
  ]},
  { category: 'Growth', features: [
    { name: 'Growth prediction', free: false, creator: true, pro: true, agency: true },
    { name: 'Performance suggestions', free: false, creator: true, pro: true, agency: true },
    { name: 'Competitor tracker', free: false, creator: false, pro: '3 channels', agency: true },
    { name: 'Trend scanner', free: false, creator: false, pro: true, agency: true },
  ]},
  { category: 'Shorts + Live', features: [
    { name: 'Shorts analytics', free: false, creator: true, pro: true, agency: true },
    { name: 'Shorts script', free: false, creator: true, pro: true, agency: true },
    { name: 'Long video → Shorts', free: false, creator: false, pro: true, agency: true },
    { name: 'Live stream intelligence', free: false, creator: false, pro: true, agency: true },
  ]},
  { category: 'Platform', features: [
    { name: 'Channels', free: '1', creator: '1', pro: '3', agency: '25' },
    { name: 'Video uploads/month', free: '0', creator: '5', pro: '20', agency: '∞' },
    { name: 'Team seats', free: '1', creator: '1', pro: '3', agency: '10' },
    { name: 'API access', free: false, creator: false, pro: 'Basic', agency: 'Full' },
  ]},
]

const CellValue = ({ value }) => {
  if (value === true) return <Check size={16} className="text-emerald mx-auto" />
  if (value === false) return <X size={14} className="text-gray-700 mx-auto" />
  return <span className="text-sm text-gray-300 font-medium">{value}</span>
}

const PLAN_PRICES = {
  free: { price: '₹0', note: 'Free forever' },
  creator: { price: '₹199', note: '→ ₹399/mo' },
  pro: { price: '₹499', note: '→ ₹899/mo' },
  agency: { price: '₹2999', note: '→ ₹5999/mo' },
}

export const Pricing = () => {
  const navigate = useNavigate()
  const plans = ['free', 'creator', 'pro', 'agency']
  const planColors = { free: 'gray', creator: 'brand', pro: 'cyan', agency: 'rose' }

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
              <span className="font-display font-bold text-white">TubeOS</span>
            </div>
          </button>
          <Button size="sm" onClick={() => navigate('/signup')}>Get Started</Button>
        </div>
      </nav>

      <div className="pt-28 pb-20 px-5">
        <div className="max-w-7xl mx-auto">

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

          {/* Plan headers */}
          <div className="grid grid-cols-5 gap-4 mb-2 sticky top-16 z-10
                          bg-base-900/95 backdrop-blur-sm py-4 -mx-5 px-5">
            <div /> {/* Feature column */}
            {plans.map(plan => (
              <div
                key={plan}
                className={`p-4 rounded-xl text-center
                            ${plan === 'creator' ? 'bg-brand/10 border border-brand/30' : 'glass'}`}
              >
                <p className="font-display font-bold text-white capitalize mb-1">{plan}</p>
                <p className={`text-2xl font-display font-bold text-${planColors[plan]}`}>
                  {PLAN_PRICES[plan].price}
                  <span className="text-sm text-gray-500 font-normal">/mo</span>
                </p>
                <p className="text-2xs text-gray-600 mt-0.5">{PLAN_PRICES[plan].note}</p>
                <Button
                  size="xs"
                  variant={plan === 'creator' ? 'brand' : 'ghost'}
                  className="mt-3 w-full"
                  onClick={() => navigate('/signup')}
                >
                  {plan === 'free' ? 'Get Free' : 'Start'}
                </Button>
              </div>
            ))}
          </div>

          {/* Feature table */}
          <div className="space-y-6">
            {FEATURES_TABLE.map(({ category, features }) => (
              <div key={category}>
                <div className="grid grid-cols-5 gap-4">
                  {/* Category header */}
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

          {/* Bottom CTA */}
          <div className="text-center mt-16 pt-8 border-t border-white/8">
            <p className="text-gray-400 mb-4">All plans include a 14-day free trial. No credit card required.</p>
            <Button size="lg" onClick={() => navigate('/signup')}>
              Start Free Today
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
