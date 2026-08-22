// src/components/features/PlanActivatedModal.jsx
// Prominent full-screen celebration shown the moment a user opens the app
// after an admin has activated a plan for them — see notification type
// 'plan_activated' (backend/src/controllers/admin.controller.js).
import { Chingari } from './Chingari'
import { Button } from '../ui/Button'

export const PlanActivatedModal = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-sm bg-base-700 border border-brand/30 rounded-2xl
                   shadow-glow overflow-hidden animate-slide-up text-center"
      >
        <div className="h-1.5 bg-brand-gradient" />

        <div className="relative p-7">
          <div className="absolute inset-0 bg-card-gradient pointer-events-none" />

          <div className="relative">
            <Chingari mood="celebrate" size={76} className="mx-auto mb-4" />

            <h2 className="font-display font-bold text-2xl text-white mb-2">
              🎉 Congratulations!
            </h2>

            <p className="text-gray-300 text-sm leading-relaxed mb-6">{message}</p>

            <Button onClick={onClose} fullWidth size="lg">
              Let&apos;s go 🚀
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
