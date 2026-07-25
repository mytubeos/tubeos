// src/components/features/Chingari.jsx
// TubeOS's mascot — see index.css's ".chingari" block for the shape/mood CSS.
const MOODS = [
  'idle',
  'celebrate',
  'hype',
  'curious',
  'proud',
  'playful',
  'thinking',
  'nudge',
  'sleepy',
]

export const Chingari = ({ mood = 'idle', size = 48, className = '' }) => {
  const safeMood = MOODS.includes(mood) ? mood : 'idle'

  return (
    <div
      className={`chingari ${safeMood !== 'idle' ? `chingari--${safeMood}` : ''} ${className}`}
      style={{ '--chingari-size': `${size}px` }}
    >
      <div className="chingari__glow" />
      <div className="chingari__tip" />
      <div className="chingari__body" />
      <div className="chingari__face">
        <div className="chingari__cheek chingari__cheek--l" />
        <div className="chingari__cheek chingari__cheek--r" />
        <div className="chingari__eye chingari__eye--l" />
        <div className="chingari__eye chingari__eye--r" />
        <div className="chingari__mouth" />
      </div>
    </div>
  )
}
