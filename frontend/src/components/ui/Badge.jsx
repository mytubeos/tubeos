// src/components/ui/Badge.jsx
export const Badge = ({ children, variant = 'brand', size = 'sm', dot = false }) => {
  const variants = {
    brand: 'bg-brand/15 text-brand border border-brand/20',
    cyan: 'bg-cyan/15 text-cyan border border-cyan/20',
    emerald: 'bg-emerald/15 text-emerald border border-emerald/20',
    rose: 'bg-rose/15 text-rose border border-rose/20',
    amber: 'bg-amber/15 text-amber border border-amber/20',
    purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
    gray: 'bg-white/5 text-gray-400 border border-white/10',
  }

  const dotColors = {
    brand: 'bg-brand', cyan: 'bg-cyan', emerald: 'bg-emerald',
    rose: 'bg-rose', amber: 'bg-amber', gray: 'bg-gray-400',
  }

  const sizes = {
    xs: 'text-2xs px-1.5 py-0.5 rounded-md',
    sm: 'text-xs px-2 py-0.5 rounded-md',
    md: 'text-sm px-2.5 py-1 rounded-lg',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium
                      ${variants[variant]} ${sizes[size]}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} animate-pulse`} />
      )}
      {children}
    </span>
  )
}

export const PlanBadge = ({ plan }) => {
  const config = {
    free: { label: 'Free', variant: 'gray' },
    creator: { label: 'Creator', variant: 'brand' },
    pro: { label: 'Pro', variant: 'cyan' },
    agency: { label: 'Agency', variant: 'rose' },
  }
  const { label, variant } = config[plan] || config.free

  return <Badge variant={variant} size="sm">{label}</Badge>
}

export const StatusBadge = ({ status }) => {
  const config = {
    draft: { label: 'Draft', variant: 'gray', dot: false },
    scheduled: { label: 'Scheduled', variant: 'brand', dot: true },
    uploading: { label: 'Uploading', variant: 'cyan', dot: true },
    processing: { label: 'Processing', variant: 'amber', dot: true },
    published: { label: 'Published', variant: 'emerald', dot: false },
    failed: { label: 'Failed', variant: 'rose', dot: false },
    cancelled: { label: 'Cancelled', variant: 'gray', dot: false },
    active: { label: 'Active', variant: 'emerald', dot: true },
    connected: { label: 'Connected', variant: 'emerald', dot: true },
    disconnected: { label: 'Disconnected', variant: 'gray', dot: false },
  }
  const { label, variant, dot } = config[status] || { label: status, variant: 'gray' }

  return <Badge variant={variant} size="sm" dot={dot}>{label}</Badge>
}

export const SentimentBadge = ({ sentiment }) => {
  const config = {
    positive: { label: '😊 Positive', variant: 'emerald' },
    neutral: { label: '😐 Neutral', variant: 'gray' },
    negative: { label: '😤 Negative', variant: 'rose' },
    question: { label: '❓ Question', variant: 'cyan' },
    spam: { label: '🚫 Spam', variant: 'amber' },
  }
  const { label, variant } = config[sentiment] || config.neutral

  return <Badge variant={variant} size="xs">{label}</Badge>
}
