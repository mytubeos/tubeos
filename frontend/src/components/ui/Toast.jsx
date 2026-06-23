// src/components/ui/Toast.jsx
// Wrapper around react-hot-toast with consistent styling
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

export const Toast = ({ type = 'info', message, className = '' }) => {
  if (!message) return null
  const styles = {
    error: 'bg-red-500/10 border border-red-500/30 text-red-300',
    success: 'bg-green-500/10 border border-green-500/30 text-green-300',
    info: 'bg-blue-500/10 border border-blue-500/30 text-blue-300',
    warning: 'bg-amber-500/10 border border-amber-500/30 text-amber-300',
  }
  return (
    <div className={`px-4 py-3 rounded-lg text-sm ${styles[type] || styles.info} ${className}`}>
      {message}
    </div>
  )
}

export const showToast = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  loading: (msg) => toast.loading(msg),
  dismiss: (id) => toast.dismiss(id),

  promise: (promise, { loading, success, error }) =>
    toast.promise(promise, { loading, success, error }),

  custom: (msg, type = 'info') => {
    const icons = {
      info: <Info size={16} className="text-brand" />,
      success: <CheckCircle size={16} className="text-emerald" />,
      error: <XCircle size={16} className="text-rose" />,
      warning: <AlertCircle size={16} className="text-amber" />,
    }

    toast.custom((t) => (
      <div className={`flex items-center gap-3 bg-base-600 border border-white/10 
                       rounded-xl px-4 py-3 shadow-xl transition-all duration-300
                       ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        {icons[type]}
        <p className="text-sm text-gray-200 font-body">{msg}</p>
      </div>
    ))
  },
}
