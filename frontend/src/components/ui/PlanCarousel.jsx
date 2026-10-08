import { Children, useRef, useState } from 'react'

// Native scrolling keeps touch, keyboard and reduced-motion behaviour predictable.
export const PlanCarousel = ({ children, labels, desktopGrid = true }) => {
  const cards = Children.toArray(children)
  const track = useRef(null)
  const [active, setActive] = useState(0)
  const select = (index) => {
    const node = track.current?.children[index]
    if (!node) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    track.current.scrollTo({
      left: node.offsetLeft,
      behavior: reduced ? 'auto' : 'smooth',
    })
    setActive(index)
  }
  return (
    <section aria-label="Choose a plan">
      <div className={`flex flex-wrap justify-center gap-2 mb-3 ${desktopGrid ? 'md:hidden' : ''}`}>
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={active === index}
            onClick={() => select(index)}
            className={`px-3 min-h-11 rounded-full text-sm transition-colors ${active === index ? 'bg-brand text-white' : 'bg-white/5 text-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={track}
        className={`plan-carousel ${desktopGrid ? 'plan-carousel-grid' : ''}`}
        onScroll={() => {
          const el = track.current
          const distances = Array.from(el.children).map((child) =>
            Math.abs(Math.min(child.offsetLeft, el.scrollWidth - el.clientWidth) - el.scrollLeft)
          )
          setActive(distances.indexOf(Math.min(...distances)))
        }}
      >
        {cards.map((card, index) => (
          <div key={labels[index]} className="plan-carousel-item">
            {card}
          </div>
        ))}
      </div>
      <div
        className={`flex justify-center items-center gap-1 mt-2 ${desktopGrid ? 'md:hidden' : ''}`}
      >
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => select(index)}
            aria-label={`Show ${label} plan`}
            aria-pressed={active === index}
            className="w-9 h-9 grid place-items-center"
          >
            <span
              className={`h-1.5 rounded-full transition-all ${active === index ? 'w-6 bg-brand' : 'w-1.5 bg-gray-500'}`}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
