import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { Button } from '../../components/ui/Button'

export const AdminContentReports = () => {
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try {
      setReports((await api.get('/admin/content-reports')).data.data)
      setError('')
    } catch {
      setError('Reports could not be loaded. Please retry.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])
  const review = async (id) => {
    try {
      await api.patch(`/admin/content-reports/${id}`, { status: 'reviewed' })
      await load()
    } catch {
      setError('Status was not saved. Please retry.')
    }
  }
  return (
    <div className="p-5 max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-white">Open AI content reports</h1>
      <p className="text-sm text-gray-400">
        Review reports regularly, investigate the output and adjust generation safeguards. Marking
        reviewed does not fix the underlying issue. Reports expire after 180 days.
      </p>
      {error && (
        <p role="alert" className="text-rose">
          {error}
        </p>
      )}
      <Button size="sm" onClick={load}>
        Refresh reports
      </Button>
      {loading && <p className="text-gray-400">Loading…</p>}
      {!loading && !reports.length && <p className="text-gray-400">No reports received.</p>}
      {reports.map((r) => (
        <article
          key={r._id}
          className="p-4 rounded-xl border border-white/10 space-y-3 text-sm text-gray-300 break-words"
        >
          <p>
            {r.reason} · {r.status} · {r.source}
          </p>
          <p>{new Date(r.createdAt).toLocaleString()}</p>
          <pre className="whitespace-pre-wrap font-sans">{r.excerpt}</pre>
          <p>{r.details}</p>
          {r.status === 'open' && (
            <Button size="sm" onClick={() => review(r._id)}>
              Mark reviewed
            </Button>
          )}
        </article>
      ))}
    </div>
  )
}
