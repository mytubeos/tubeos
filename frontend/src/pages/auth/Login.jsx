// src/pages/auth/Login.jsx
// Login page - signin with email and password
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, loading, error } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState('');

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setLocalError('');
  };

  // Validate form
  const validateForm = () => {
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setLocalError('Invalid email format');
      return false;
    }
    if (!formData.password) {
      setLocalError('Password is required');
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await login(formData.email, formData.password);

    if (result.success) {
      // Redirect to dashboard
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TubeOS</h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 rounded-2xl p-8 shadow-2xl"
        >
          {/* Email Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-200">
                Password
              </label>
              <Link
                to="/auth/forgot-password"
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {(localError || error) && (
            <Toast
              type="error"
              message={localError || error}
              className="mb-4"
            />
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full mb-4"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          {/* No account yet */}
          <p className="text-center text-slate-400">
            Don't have an account?{' '}
            <Link to="/auth/signup" className="text-purple-400 hover:text-purple-300">
              Create one
            </Link>
          </p>
        </form>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-200 font-medium mb-2">
            💡 Demo Credentials:
          </p>
          <p className="text-xs text-amber-200/80 font-mono">
            Email: demo@example.com
            <br />
            Password: Demo123456
          </p>
        </div>
      </div>
    </div>
  );
}
