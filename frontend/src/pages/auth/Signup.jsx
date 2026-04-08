// src/pages/auth/Signup.jsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, Gift } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

export const Signup = () => {
  const { register, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  const [form, setForm] = useState({
    name: '', email: '', password: '', referralCode: refCode,
  })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  const set = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim() || form.name.length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email required'
    if (!form.password || form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errs.password = 'Password needs uppercase letter and number'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const result = await register(form)
    if (result.success) {
      setSuccess(true)
    } else {
      toast.error(result.message || 'Registration failed')
      if (result.message?.includes('Email')) {
        setErrors({ email: 'Email already registered' })
      }
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-emerald/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Mail size={28} className="text-emerald" />
        </div>
        <h2 className="font-display font-bold text-white text-2xl mb-3">Check your inbox!</h2>
        <p className="text-gray-400 text-sm mb-6">
          We sent a verification link to <span className="text-white font-medium">{form.email}</span>
        </p>
        <p className="text-gray-500 text-xs">
          Didn't get it? Check spam or{' '}
          <button onClick={() => setSuccess(false)} className="text-brand hover:underline">
            try again
          </button>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display font-bold text-white text-3xl mb-2">Create account</h1>
        <p className="text-gray-500 text-sm">
          Join TubeOS and grow your YouTube channel with AI
        </p>
      </div>

      {/* Founders counter */}
      <div className="mb-6 p-3 glass rounded-xl border border-brand/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Founders spots (Creator plan)</span>
          <span className="text-xs font-bold text-brand">88 left</span>
        </div>
        <div className="h-1.5 bg-base-500 rounded-full overflow-hidden">
          <div className="h-full bg-brand-gradient rounded-full" style={{ width: '82%' }} />
        </div>
        <p className="text-2xs text-gray-600 mt-1.5">412/500 spots taken — ₹199/mo locked forever</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          name="name"
          placeholder="Rahul Sharma"
          value={form.name}
          onChange={set('name')}
          icon={User}
          error={errors.name}
          required
        />

        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set('email')}
          icon={Mail}
          error={errors.email}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">
            Password <span className="text-rose">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
              <Lock size={16} />
            </div>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Min 8 chars, uppercase + number"
              value={form.password}
              onChange={set('password')}
              className={`input-field pl-10 pr-10 ${errors.password ? 'border-rose/50' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <p className="text-rose text-xs">{errors.password}</p>}
        </div>

        <Input
          label="Referral Code (Optional)"
          name="referralCode"
          placeholder="e.g. RAHUL4291"
          value={form.referralCode}
          onChange={set('referralCode')}
          icon={Gift}
          hint={form.referralCode ? '10% discount applied for 3 months! 🎉' : ''}
        />

        <Button type="submit" fullWidth loading={isLoading} size="lg">
          Create Account
        </Button>
      </form>

      <p className="text-gray-600 text-xs text-center mt-4">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>

      <div className="mt-6 text-center">
        <p className="text-gray-500 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-light font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
