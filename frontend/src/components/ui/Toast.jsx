// src/components/ui/Toast.jsx
// Wrapper around react-hot-toast with consistent styling
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

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
