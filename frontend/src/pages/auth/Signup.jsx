// src/pages/auth/Signup.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import authApi from '../../api/auth.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Toast } from '../../components/ui/Toast';

export const Signup = () => {
  const navigate = useNavigate();
  const { register, verifyEmail, isLoading: loading } = useAuthStore();

  const [step, setStep] = useState('signup');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });
  const [otpData, setOtpData] = useState({ userId: '', otp: '' });
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resending, setResending] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError('');
  };

  const validateSignupForm = () => {
    if (!formData.name.trim() || formData.name.length < 2) {
      setLocalError('Name must be at least 2 characters');
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setLocalError('Invalid email format');
      return false;
    }
    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validateSignupForm()) return;

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.referralCode || null
    );

    if (result.success) {
      setOtpData({ userId: result.userId, otp: '' });
      setStep('otp');
      setSuccessMsg('OTP sent to your email. Please enter it below.');
    } else {
      setLocalError(result.message || 'Registration failed');
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    setLocalError('');
    setSuccessMsg('');
    try {
      await authApi.resendOTP(formData.email);
      setSuccessMsg('New OTP sent! Check your email or spam folder.');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtpData((prev) => ({ ...prev, otp: value }));
    setLocalError('');
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otpData.otp.length !== 6) {
      setLocalError('OTP must be 6 digits');
      return;
    }

    const result = await verifyEmail(otpData.userId, otpData.otp);

    if (result.success) {
      setSuccessMsg('Email verified! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } else {
      setLocalError(result.message || 'OTP verification failed');
    }
  };

  // ==================== SIGNUP FORM ====================
  if (step === 'signup') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">TubeOS</h1>
            <p className="text-slate-400">Create your account</p>
          </div>

          <form
            onSubmit={handleSignupSubmit}
            className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
          >
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-200 mb-2">Full Name</label>
              <Input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" disabled={loading} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-200 mb-2">Email Address</label>
              <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="john@example.com" disabled={loading} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-200 mb-2">Password (min 8 characters)</label>
              <Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" disabled={loading} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-200 mb-2">Confirm Password</label>
              <Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" disabled={loading} />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">Referral Code (Optional)</label>
              <Input type="text" name="referralCode" value={formData.referralCode} onChange={handleChange} placeholder="Enter referral code" disabled={loading} />
            </div>

            {localError && <Toast type="error" message={localError} className="mb-4" />}

            <Button type="submit" disabled={loading} className="w-full mb-4">
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <p className="text-center text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-400 hover:text-purple-300">Sign in</Link>
            </p>
          </form>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-200">
              An OTP will be sent to your email for verification. Check your spam folder if you don't see it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== OTP VERIFICATION FORM ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Verify Email</h1>
          <p className="text-slate-400">Enter the 6-digit OTP sent to {formData.email}</p>
        </div>

        <form
          onSubmit={handleOtpSubmit}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-200 mb-4 text-center">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={otpData.otp}
              onChange={handleOtpChange}
              placeholder="000000"
              maxLength="6"
              disabled={loading}
              className="w-full px-4 py-3 text-center text-3xl tracking-widest font-mono bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition disabled:opacity-50"
            />
          </div>

          {successMsg && <Toast type="success" message={successMsg} className="mb-4" />}
          {localError && <Toast type="error" message={localError} className="mb-4" />}

          <Button type="submit" disabled={loading || otpData.otp.length !== 6} className="w-full mb-4">
            {loading ? 'Verifying...' : 'Verify Email'}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-slate-400 text-sm">
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading || resending}
                className="text-purple-400 hover:text-purple-300 disabled:opacity-50 font-medium"
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
            </p>
            <p className="text-slate-500 text-xs">
              Wrong email?{' '}
              <button
                type="button"
                onClick={() => setStep('signup')}
                disabled={loading}
                className="text-slate-400 hover:text-slate-300 disabled:opacity-50"
              >
                Go back
              </button>
            </p>
          </div>
        </form>

        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-200">
            OTP expires in 10 minutes. Check your spam folder if not found.
          </p>
        </div>
      </div>
    </div>
  );
}
