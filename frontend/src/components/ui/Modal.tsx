// src/components/ui/Modal.jsx
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  className = '',
  mobileSheet = false,
}) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        ) || []
      )
    ;(focusable()[0] || panel)?.focus()
    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key === 'Tab') {
        const nodes = focusable()
        const first = nodes[0],
          last = nodes[nodes.length - 1]
        if (!first) {
          event.preventDefault()
          panel?.focus()
          return
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex justify-center ${mobileSheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex flex-col max-h-[calc(100dvh-2rem)] w-full ${sizes[size]} bg-base-700 border border-white/10
                       ${mobileSheet ? 'rounded-t-3xl sm:rounded-2xl pb-[env(safe-area-inset-bottom)]' : 'rounded-2xl'} shadow-2xl animate-slide-up ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 shrink-0 border-b border-white/8">
          <h2 id={titleId} className="font-display font-semibold text-white text-lg">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center
                       text-gray-400 hover:text-white hover:bg-white/8 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 min-h-0 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-5 shrink-0 border-t border-white/8 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={confirmVariant} size="sm" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-gray-400 text-sm">{message}</p>
  </Modal>
)
