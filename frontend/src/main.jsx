import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { initSentry, Sentry } from './utils/sentry'
import './index.css'

initSentry()

const ErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-base-900 text-center px-5">
    <div>
      <p className="text-white font-display font-bold text-2xl mb-2">Something went wrong</p>
      <p className="text-gray-500 mb-6">Please refresh the page. Our team has been notified.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 bg-brand-gradient text-white font-semibold rounded-xl"
      >
        Reload
      </button>
    </div>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141422',
              color: '#F9FAFB',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#06060A' },
            },
            error: {
              iconTheme: { primary: '#F43F5E', secondary: '#06060A' },
            },
          }}
        />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
