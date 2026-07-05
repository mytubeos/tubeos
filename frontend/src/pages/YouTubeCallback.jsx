// src/pages/YouTubeCallback.jsx
// Popup window pe khulta hai after Google OAuth redirect
// Parent window ko postMessage se notify karta hai phir auto-close ho jaata hai

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export const YouTubeCallback = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    const connected = searchParams.get('youtube_connected')
    const error = searchParams.get('youtube_error')
    const channel = searchParams.get('channel')

    if (connected === 'true') {
      setStatus('success')
      // Parent window ko notify karo
      if (window.opener) {
        window.opener.postMessage({ type: 'YOUTUBE_CONNECTED', channel }, window.location.origin)
      }
    } else if (error) {
      setStatus('error')
      if (window.opener) {
        window.opener.postMessage({ type: 'YOUTUBE_ERROR', error }, window.location.origin)
      }
    }

    // 1.5 sec baad popup band karo
    const timer = setTimeout(() => {
      window.close()
    }, 1500)

    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300">Connecting YouTube...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-green-400 font-semibold text-lg">Connected!</p>
            <p className="text-slate-400 text-sm mt-1">This window will close automatically.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-400 font-semibold text-lg">Connection Failed</p>
            <p className="text-slate-400 text-sm mt-1">This window will close automatically.</p>
          </>
        )}
      </div>
    </div>
  )
}
