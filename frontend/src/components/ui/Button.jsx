// src/components/ui/Button.jsx
import { Spinner } from './Spinner'

export const Button = ({
  children, variant = 'brand', size = 'md',
  loading = false, disabled = false,
  className = '', icon: Icon, iconRight,
  onClick, type = 'button', fullWidth = false,
}) => {
  const base = `inline-flex items-center justify-center gap-2 font-body font-medium
                transition-all duration-200 active:scale-95 select-none
                disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`

  const variants = {
    brand: `bg-brand hover:bg-brand-light text-white shadow-lg
            hover:shadow-brand`,
    ghost: `bg-transparent border border-white/10 text-gray-300
            hover:bg-white/5 hover:border-white/20 hover:text-white`,
    danger: `bg-rose/10 border border-rose/20 text-rose
             hover:bg-rose/20`,
    success: `bg-emerald/10 border border-emerald/20 text-emerald
              hover:bg-emerald/20`,
    subtle: `bg-white/5 text-gray-300 hover:bg-white/8 hover:text-white`,
    link: `bg-transparent text-brand hover:text-brand-light underline-offset-4
           hover:underline p-0`,
  }

  const sizes = {
    xs: 'h-7 px-2.5 text-xs rounded-md',
    sm: 'h-8 px-3.5 text-sm rounded-lg',
    md: 'h-10 px-5 text-sm rounded-lg',
    lg: 'h-12 px-6 text-base rounded-xl',
    xl: 'h-14 px-8 text-lg rounded-xl',
  }

  if (variant === 'link') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`${base} ${variants.link} ${className}`}
      >
        {loading ? <Spinner size="sm" /> : Icon && <Icon size={14} />}
        {children}
      </button>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]}
                  ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size="sm" color="white" /> : Icon && <Icon size={16} />}
      {children}
      {iconRight && !loading && <span className="ml-1">{iconRight}</span>}
    </button>
  )
}
