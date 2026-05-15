// src/pages/auth/ForgotPassword.jsx
// Forgot password page - request password reset link
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Validate email
  const validateEmail = () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setLocalError('Invalid email format');
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmail()) return;

    const result = await forgotPassword(email);

    if (result.success) {
      setSuccessMsg(result.message);
      setSubmitted(true);
      setLocalError('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/auth/login');
      }, 3000);
    }
  };

  // ==================== SUBMITTED STATE ====================
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-slate-400">
              We've sent a password reset link to <span className="font-medium text-slate-200">{email}</span>
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
            {/* Steps */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-purple-500 text-white text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="text-slate-200 font-medium">Check your email</p>
                  <p className="text-sm text-slate-400">Look for an email from TubeOS</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-purple-500 text-white text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="text-slate-200 font-medium">Click the reset link</p>
                  <p className="text-sm text-slate-400">Link expires in 15 minutes</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-purple-500 text-white text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="text-slate-200 font-medium">Create a new password</p>
                  <p className="text-sm text-slate-400">Make it strong and unique</p>
                </div>
              </div>
            </div>

            {/* Success Message */}
            <Toast
              type="success"
              message={successMsg}
              className="mb-6"
            />

            {/* Back to Login */}
            <Link
              to="/auth/login"
              className="block w-full text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
            >
              Back to Login
            </Link>

            {/* Resend Option */}
            <p className="text-center text-slate-400 text-sm mt-4">
              Didn't receive the email?{' '}
              <button
                onClick={() => setSubmitted(false)}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                Try again
              </button>
            </p>
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-200">
              💡 Check your spam or promotional folder if you don't see the email
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== FORM STATE ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLocalError('');
              }}
              placeholder="john@example.com"
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {localError && (
            <Toast
              type="error"
              message={localError}
              className="mb-4"
            />
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !email}
            className="w-full mb-4"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          {/* Back to Login */}
          <p className="text-center text-slate-400">
            Remembered your password?{' '}
            <Link to="/auth/login" className="text-purple-400 hover:text-purple-300">
              Sign in
            </Link>
          </p>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-200">
            ⏱️ Reset link will expire in 15 minutes for security
          </p>
        </div>
      </div>
    </div>
  );
          }
