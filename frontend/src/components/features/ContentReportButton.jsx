import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../../api/axios'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

export const ContentReportButton = () => {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('unsafe')
  const [excerpt, setExcerpt] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const send = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await api.post('/content-reports', { source: pathname, reason, excerpt, details })
      setSent(true)
      setMessage('Report received. Thank you for helping us review unsafe AI content.')
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not send the report. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        className="text-xs text-gray-400 underline py-2"
        onClick={() => {
          setOpen(true)
          setSent(false)
          setMessage('')
        }}
      >
        Report AI content
      </button>
      <Modal
        isOpen={open}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
        title="Report AI content"
      >
        {sent ? (
          <p role="status" className="text-sm text-emerald">
            {message}
          </p>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <p className="text-sm text-gray-400">
              Report unsafe or offensive titles, scripts, images, or replies without leaving Vezrin.
              Include only the relevant output; do not include passwords or private account details.
            </p>
            <label className="block text-sm text-gray-300">
              Reason
              <select
                aria-label="Report reason"
                className="input-field w-full mt-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="unsafe">Unsafe content</option>
                <option value="hate_harassment">Hate or harassment</option>
                <option value="sexual_content">Sexual content</option>
                <option value="child_safety">Child safety</option>
                <option value="misleading">Misleading content</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block text-sm text-gray-300">
              Content or image URL
              <textarea
                aria-label="Reported content"
                className="input-field w-full mt-1"
                rows={4}
                maxLength={10000}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
              />
            </label>
            <label className="block text-sm text-gray-300">
              What happened?
              <textarea
                aria-label="Report details"
                className="input-field w-full mt-1"
                rows={3}
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            {message && (
              <p role="alert" className="text-sm text-rose">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy || (!excerpt.trim() && !details.trim())}>
              {busy ? 'Sending…' : 'Send report'}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
