// src/pages/referral/Referral.jsx
import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Share2, Users, TrendingUp, Trophy, Zap } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { formatNumber } from '../../utils/formatters'
import toast from 'react-hot-toast'

const TIERS = [
  {
    name: 'Starter',
    range: '1–9 referrals',
    commission: '10%',
    discount: '10%',
    color: 'brand',
    icon: '🌱',
  },
  {
    name: 'Grower',
    range: '10–24 referrals',
    commission: '12%',
    discount: '10%',
    color: 'cyan',
    icon: '🌿',
  },
  {
    name: 'Champion',
    range: '25–49 referrals',
    commission: '15%',
    discount: '10%',
    color: 'emerald',
    icon: '🌳',
  },
  {
    name: 'Legend',
    range: '50+ referrals',
    commission: '20%',
    discount: '10%',
    color: 'amber',
    icon: '👑',
    special: 'FREE PRO for life + featured on website!',
  },
]

export const Referral = () => {
  const { user } = useAuthStore()
  const [copied, setCopied] = useState(false)
  const [stats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: 0,
    pendingPayout: 0,
    currentTier: 'Starter',
  })

  const referralCode = user?.referralCode || 'LOADING'
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Code copied!')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast.success('Link copied!')
  }

  const shareOnTwitter = () => {
    const text = `I'm using TubeOS to grow my YouTube channel with AI. Use my code ${referralCode} for 10% off! 🚀`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`, '_blank')
  }

  const shareOnWhatsApp = () => {
    const text = `TubeOS use karo apna YouTube channel grow karne ke liye! Use code: ${referralCode} for 10% off 🎉\n${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  // Current tier based on referrals
  const currentTierIndex = stats.totalReferrals >= 50 ? 3
    : stats.totalReferrals >= 25 ? 2
    : stats.totalReferrals >= 10 ? 1 : 0
  const currentTier = TIERS[currentTierIndex]

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Hero card */}
      <div className="relative overflow-hidden glass p-6 rounded-2xl border border-brand/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full
                        blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-brand/15 rounded-2xl flex items-center justify-center">
              <Gift size={24} className="text-brand" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-xl">Refer & Earn</h2>
              <p className="text-gray-500 text-sm">Earn 10-20% commission for every referral</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Referrals', value: stats.totalReferrals, icon: Users },
              { label: 'Active', value: stats.activeReferrals, icon: Zap },
              { label: 'Earned', value: `₹${formatNumber(stats.totalEarned)}`, icon: TrendingUp },
              { label: 'Pending', value: `₹${formatNumber(stats.pendingPayout)}`, icon: Gift },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass p-3 rounded-xl text-center">
                <p className="font-display font-bold text-white text-lg">{value}</p>
                <p className="text-2xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Referral code */}
          <div className="flex items-center gap-3 p-3 bg-base-600 rounded-xl border border-white/10">
            <div className="flex-1 min-w-0">
              <p className="text-2xs text-gray-500 mb-0.5">Your referral code</p>
              <p className="font-mono font-bold text-brand text-lg tracking-widest">
                {referralCode}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-3 py-2 glass rounded-lg
                         text-sm text-gray-300 hover:text-brand transition-all"
            >
              {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="ghost" icon={Copy} onClick={copyLink}>
              Copy Link
            </Button>
            <Button size="sm" variant="ghost" onClick={shareOnWhatsApp}>
              📱 WhatsApp
            </Button>
            <Button size="sm" variant="ghost" onClick={shareOnTwitter}>
              🐦 Twitter/X
            </Button>
          </div>
        </div>
      </div>

      {/* Current tier */}
      <Card>
        <CardHeader title="Your Tier" icon={Trophy} iconColor="amber" />
        <div className="flex items-center gap-4 p-4 glass rounded-xl border border-amber/15 bg-amber/5">
          <span className="text-4xl">{currentTier.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-display font-bold text-white text-xl">{currentTier.name}</p>
              <Badge variant="amber" size="sm">{currentTier.commission} commission</Badge>
            </div>
            <p className="text-sm text-gray-400">{currentTier.range}</p>
            {currentTier.special && (
              <p className="text-xs text-amber mt-1">⭐ {currentTier.special}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Tier progression */}
      <Card>
        <CardHeader title="Commission Tiers" subtitle="More referrals = higher commission" icon={TrendingUp} />
        <div className="space-y-3">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className={`flex items-center gap-4 p-3 rounded-xl transition-all
                          ${i === currentTierIndex
                            ? 'bg-brand/10 border border-brand/25'
                            : i < currentTierIndex
                            ? 'opacity-50'
                            : 'glass'}`}
            >
              <span className="text-2xl shrink-0">{tier.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-white">{tier.name}</p>
                  {i === currentTierIndex && (
                    <Badge variant="brand" size="xs" dot>Current</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500">{tier.range}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold text-${tier.color}`}>
                  {tier.commission}
                </p>
                <p className="text-2xs text-gray-500">commission</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader title="How It Works" icon={Gift} />
        <div className="space-y-4">
          {[
            {
              step: '1',
              title: 'Share your code',
              desc: 'Give your referral code or link to anyone who wants to use TubeOS.',
            },
            {
              step: '2',
              title: 'They sign up & pay',
              desc: 'They get 10% off for their first 3 months. You earn commission when they pay.',
            },
            {
              step: '3',
              title: 'You earn 10-20%',
              desc: 'Commission credited for 6 months per referral. Withdraw via UPI/bank transfer.',
            },
            {
              step: '4',
              title: 'Reach Legend tier',
              desc: '50+ referrals = 20% commission + FREE PRO plan for life + featured on website!',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-brand/15 text-brand text-sm font-bold
                              flex items-center justify-center shrink-0 font-display mt-0.5">
                {step}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 p-3 bg-brand/5 border border-brand/15 rounded-xl">
          <p className="text-xs text-gray-400">
            <span className="text-brand font-medium">Note:</span> Referral code can't be used for self-referral.
            Minimum 1 paid month before payout. Commission lasts for 6 billing cycles per referral.
          </p>
        </div>
      </Card>
    </div>
  )
}
