// src/components/ui/Spinner.jsx
export const Spinner = ({ size = 'md', color = 'brand' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10', xl: 'w-16 h-16' }
  const colors = {
    brand: 'border-brand',
    cyan: 'border-cyan',
    white: 'border-white',
    gray: 'border-gray-400',
  }

  return (
    <div
      className={`${sizes[size]} border-2 border-white/10 ${colors[color]} border-t-transparent
                  rounded-full animate-spin`}
    />
  )
}

export const PageLoader = () => (
  <div className="fixed inset-0 bg-base-900 flex items-center justify-center z-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-white/5 rounded-full" />
        <div className="w-16 h-16 border-2 border-brand border-t-transparent rounded-full animate-spin absolute inset-0" />
        <div className="w-16 h-16 border-2 border-cyan/30 border-b-transparent rounded-full animate-spin absolute inset-0"
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
        />
      </div>
      <div className="text-center">
        <p className="font-display font-bold text-white text-lg">TubeOS</p>
        <p className="text-gray-500 text-sm">Loading your command center...</p>
      </div>
    </div>
  </div>
)
