// src/pages/auth/ResetPassword.jsx
// Reset password page - change password with reset token from email link
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, loading } = useAuth();

  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tokenError, setTokenError] = useState(false);

  // Check if token exists
  useEffect(() => {
    if (!token) {
      setTokenError(true);
    }
  }, [token]);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError('');
  };

  // Validate form
  const validateForm = () => {
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !token) return;

    const result = await resetPassword(token, formData.password);

    if (result.success) {
      setSuccessMsg(result.message);
      setFormData({ password: '', confirmPassword: '' });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth/login');
      }, 2000);
    } else {
      setLocalError(result.error || 'Failed to reset password');
    }
  };

  // ==================== INVALID TOKEN STATE ====================
  if (tokenError || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Error Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4v2m0 0v2m0-6v-2m0 0V7a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2h-6a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Invalid Reset Link</h1>
            <p className="text-slate-400">
              The password reset link is missing or has expired
            </p>
          </div>

          {/* Info Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <p className="text-slate-300 mb-6">
              Reset links expire after 15 minutes for security. If your link has expired, you can request a new one.
            </p>

            <Link
              to="/auth/forgot-password"
              className="block w-full text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition mb-4"
            >
              Request New Reset Link
            </Link>

            <Link
              to="/auth/login"
              className="block w-full text-center px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SUCCESS STATE ====================
  if (successMsg) {
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
            <h1 className="text-3xl font-bold text-white mb-2">Password Reset</h1>
            <p className="text-slate-400">Your password has been successfully reset</p>
          </div>

          {/* Info Card */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl">
            <Toast
              type="success"
              message={successMsg}
              className="mb-6"
            />

            <p className="text-slate-300 mb-6">
              You can now login with your new password. Redirecting to login page...
            </p>

            <Link
              to="/auth/login"
              className="block w-full text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
            >
              Go to Login
            </Link>
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
          <h1 className="text-3xl font-bold text-white mb-2">Create New Password</h1>
          <p className="text-slate-400">
            Enter a strong password for your account
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          {/* Password Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              New Password (min 8 characters)
            </label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {/* Confirm Password Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Confirm Password
            </label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
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
            disabled={loading}
            className="w-full mb-4"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </Button>

          {/* Back to Login */}
          <p className="text-center text-slate-400">
            <Link to="/auth/login" className="text-purple-400 hover:text-purple-300">
              Back to login
            </Link>
          </p>
        </form>

        {/* Password Tips */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs font-medium text-blue-200 mb-2">💡 Strong Password Tips:</p>
          <ul className="text-xs text-blue-200/80 space-y-1">
            <li>✓ At least 8 characters long</li>
            <li>✓ Mix of uppercase and lowercase letters</li>
            <li>✓ Include numbers and special characters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
