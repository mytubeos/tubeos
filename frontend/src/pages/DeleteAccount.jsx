import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import { useChannelStore } from '../store/channelStore'
import { Button } from '../components/ui/Button'

export const DeleteAccount = () => {
  const { isAuthenticated, user } = useAuthStore()
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    if (!confirmed || !password || busy) return
    setBusy(true)
    try {
      await api.post('/auth/delete-account', { password })
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      useChannelStore.getState().clearChannels()
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
      setPassword('')
      setDone(true)
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          'Could not submit. Please try again or contact hello@vezrin.com.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="min-h-screen bg-base-900 text-gray-300 px-5 py-10">
      <div className="max-w-xl mx-auto space-y-6">
        <Link to="/" className="text-brand">
          Vezrin · VibeCore Technologies
        </Link>
        <h1 className="text-3xl text-white font-bold">Delete your Vezrin account</h1>
        {done ? (
          <p role="status">
            Your account is deactivated and deletion is scheduled within 30 days. Contact
            hello@vezrin.com if you need help with this request.
          </p>
        ) : (
          <>
            <p>
              Deleting your account disables Vezrin access and stops future Vezrin-managed uploads.
              Profile, channel data, analytics, comments, AI content and stored files are scheduled
              for deletion within 30 days.
            </p>
            <p className="text-sm">
              Videos, comments and uploads already sent to YouTube stay on YouTube. Scheduled
              releases already held by YouTube must be managed there. You can revoke Vezrin access
              in your Google account permissions.
            </p>
            <p className="text-sm">
              Minimal payment and referral transaction records may be retained for tax, accounting
              or fraud obligations. Hosting logs, backups and AI-provider records follow their
              retention terms. For provider deletion assistance or pending payouts, contact
              hello@vezrin.com.
            </p>
            <p className="text-sm">
              Account deletion does not cancel a Google Play subscription. To stop future charges,
              cancel it in{' '}
              <a
                className="text-brand underline"
                href="https://play.google.com/store/account/subscriptions?package=com.vezrin.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Play subscriptions
              </a>{' '}
              before deleting your account. You can still request deletion without canceling first.
            </p>
            {isAuthenticated ? (
              <form onSubmit={submit} className="space-y-4 border border-white/10 rounded-xl p-5">
                <p className="text-sm">Account: {user?.email}</p>
                <label className="block">
                  Current password
                  <input
                    aria-label="Current password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="input-field w-full mt-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="flex gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I understand that my Vezrin account and associated data will be deleted.
                </label>
                {message && (
                  <p role="alert" className="text-rose">
                    {message}
                  </p>
                )}
                <Button variant="danger" type="submit" disabled={!confirmed || !password || busy}>
                  {busy ? 'Submitting…' : 'Delete my account'}
                </Button>
              </form>
            ) : (
              <div className="space-y-3">
                <Link to="/login" className="text-brand underline">
                  Sign in to request deletion
                </Link>
                <p>
                  Cannot sign in or no longer have the app? Email{' '}
                  <a
                    className="text-brand underline"
                    href="mailto:hello@vezrin.com?subject=Vezrin%20account%20deletion%20request"
                  >
                    hello@vezrin.com
                  </a>{' '}
                  from your registered email address with subject “Vezrin account deletion request”.
                  We may verify ownership before acting. Do not email your password.
                </p>
              </div>
            )}
          </>
        )}
        <Link to="/privacy#account-deletion" className="block text-brand underline">
          Privacy and retention details
        </Link>
      </div>
    </main>
  )
}
