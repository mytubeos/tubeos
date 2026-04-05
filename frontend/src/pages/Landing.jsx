// src/pages/Landing.jsx
import { useNavigate } from 'react-router-dom'
import {
  Zap, BarChart3, Calendar, MessageCircle,
  Sparkles, TrendingUp, Youtube, ArrowRight,
  Check, Star, Clock, Shield, ChevronRight,
} from 'lucide-react'
import { Button } from '../components/ui/Button'

const FEATURES = [
  {
    icon: BarChart3,
    color: 'brand',
    title: 'Deep Analytics',
    desc: 'Real-time views, CTR, watch time, revenue tracking per video and channel.',
  },
  {
    icon: Clock,
    color: 'cyan',
    title: 'Time Intelligence',
    desc: 'AI-powered 7×24 heatmap. Post at the exact moment your audience is online.',
  },
  {
    icon: Calendar,
    color: 'emerald',
    title: 'Smart Scheduling',
    desc: 'Auto-publish at the best time. Set it once, TubeOS handles the rest.',
  },
  {
    icon: MessageCircle,
    color: 'amber',
    title: 'AI Comment Replies',
    desc: '500 AI replies/month in your tone. Sentiment analysis. Post with 1 click.',
  },
  {
    icon: Sparkles,
    color: 'brand',
    title: 'AI Content Engine',
    desc: 'Titles, tags, descriptions, scripts, and 50 thumbnail ideas — all AI-generated.',
  },
  {
    icon: TrendingUp,
    color: 'rose',
    title: 'Growth Intelligence',
    desc: 'Subscriber predictions, competitor tracking, and trend detection (PRO+).',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: '',
    features: ['1 channel', 'Basic analytics', 'Manual scheduling', 'View comments'],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Creator',
    price: '₹199',
    period: '/month',
    badge: 'Most Popular',
    features: [
      '1 channel',
      '500 AI comment replies',
      'Full analytics + heatmap',
      'AI titles, tags, scripts',
      '4 weekly + 30 daily reports',
      '50 thumbnail ideas',
      '5 video uploads/month',
    ],
    cta: 'Start Creator Plan',
    highlighted: true,
    note: '₹399/mo after founders offer ends',
  },
  {
    name: 'Pro',
    price: '₹499',
    period: '/month',
    features: [
      '3 channels',
      '1200 AI replies + bulk mode',
      'Competitor tracker (3)',
      'Trend scanner',
      'Live stream intelligence',
      'Long video → Shorts repurpose',
      '20 uploads/month',
    ],
    cta: 'Start Pro Plan',
    highlighted: false,
    note: '₹899/mo after founders offer ends',
  },
]

export const Landing = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-base-900 overflow-x-hidden">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-base-900/80 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-white text-lg">TubeOS</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/signup')}>
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-5 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]
                        bg-brand/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-cyan/8 rounded-full
                        blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Founders badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full
                          border border-brand/25 mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
            <span className="text-sm text-gray-300">
              Founders offer: <span className="text-brand font-semibold">₹199/mo</span> locked forever
            </span>
            <span className="text-xs text-gray-500">88 spots left</span>
          </div>

          <h1 className="font-display font-bold text-5xl sm:text-6xl lg:text-7xl text-white
                          leading-none tracking-tight mb-6 animate-slide-up">
            The AI brain for
            <br />
            <span className="bg-clip-text text-transparent bg-brand-gradient">
              YouTube creators
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8 animate-slide-up"
            style={{ animationDelay: '0.1s' }}>
            Upload, schedule, analyze, and automate your channel growth.
            One platform. Everything AI-powered.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap animate-slide-up"
            style={{ animationDelay: '0.2s' }}>
            <Button size="xl" onClick={() => navigate('/signup')} iconRight={<ArrowRight size={18} />}>
              Start for Free
            </Button>
            <Button size="xl" variant="ghost" onClick={() => navigate('/login')}>
              Sign In
            </Button>
          </div>

          <p className="text-sm text-gray-600 mt-4">
            No credit card required · Free plan forever
          </p>
        </div>

        {/* Hero stats */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-3 gap-4">
          {[
            { value: '6hr', label: 'Saved per day' },
            { value: '85%', label: 'Profit margin' },
            { value: '7×', label: 'Faster growth' },
          ].map(({ value, label }) => (
            <div key={label} className="glass p-5 rounded-2xl text-center">
              <p className="font-display font-bold text-white text-3xl">{value}</p>
              <p className="text-gray-500 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-white text-4xl mb-4">
              Everything you need to grow
            </h2>
            <p className="text-gray-500 text-lg">
              7 AI-powered modules. One creator command center.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title}
                className="glass p-6 rounded-2xl hover:border-white/15 transition-all group">
                <div className={`w-11 h-11 rounded-xl bg-${color}/10 flex items-center justify-center
                                 mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon size={21} className={`text-${color}`} />
                </div>
                <h3 className="font-display font-semibold text-white text-lg mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-5 relative">
        <div className="absolute inset-0 bg-gradient-radial from-brand/5 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-white text-4xl mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-gray-500">
              Lock in founders pricing before it goes up forever.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 rounded-2xl transition-all
                            ${plan.highlighted
                              ? 'bg-brand/10 border-2 border-brand/40 shadow-brand'
                              : 'glass'}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2
                                  bg-brand text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-5">
                  <p className="font-display font-bold text-white text-xl mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="font-display font-bold text-white text-4xl">{plan.price}</span>
                    <span className="text-gray-500 text-sm mb-1">{plan.period}</span>
                  </div>
                  {plan.note && (
                    <p className="text-2xs text-gray-600 mt-1">{plan.note}</p>
                  )}
                </div>

                <div className="space-y-2.5 mb-6">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2.5">
                      <Check size={14} className="text-emerald shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-300">{f}</span>
                    </div>
                  ))}
                </div>

                <Button
                  fullWidth
                  variant={plan.highlighted ? 'brand' : 'ghost'}
                  onClick={() => navigate('/signup')}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-brand-gradient rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Zap size={28} className="text-white" />
          </div>
          <h2 className="font-display font-bold text-white text-4xl mb-4">
            Ready to automate your growth?
          </h2>
          <p className="text-gray-500 mb-8">
            Join hundreds of creators using TubeOS to save 6 hours a day.
          </p>
          <Button size="xl" onClick={() => navigate('/signup')} iconRight={<ArrowRight size={18} />}>
            Start for Free — No Card Needed
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 bg-brand-gradient rounded-md flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="font-display font-bold text-white">TubeOS</span>
        </div>
        <p className="text-gray-600 text-sm">
          © 2026 TubeOS. Built for YouTube creators. 🇮🇳
        </p>
      </footer>
    </div>
  )
}
