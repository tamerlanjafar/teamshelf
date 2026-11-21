// Small motion helpers for the front page: appearing as you scroll, and loops that only run
// while they are on screen. Everything stands still for people who turned motion off.

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const REDUCED = '(prefers-reduced-motion: reduce)'

/** Whether the viewer asked for less motion. */
export function useReducedMotion() {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(REDUCED)
      query.addEventListener('change', listener)
      return () => query.removeEventListener('change', listener)
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
}

/** Whether an element is on screen. With `once`, it stays true after the first time. */
export function useInView<T extends Element>({ amount = 0.25, once = false } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) observer.disconnect()
      },
      { threshold: amount },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [amount, once])
  return { ref, inView }
}

/** A counter that goes up every `interval` ms while `live`. */
export function useTicker(live: boolean, interval: number) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTick((value) => value + 1), interval)
    return () => clearInterval(id)
  }, [live, interval])
  return tick
}

/** A loop for a small demo: its ref, and the step it is at (stands at `still` without motion). */
export function useLoop<T extends Element>(steps: number, interval: number, still: number) {
  const { ref, inView } = useInView<T>({ amount: 0.4 })
  const reduced = useReducedMotion()
  const tick = useTicker(inView && !reduced, interval)
  return { ref, step: reduced ? still : tick % steps }
}

/** Rises into place the first time it comes into view; `delay` in steps of 80ms. */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'li' | 'section' }) {
  const { ref, inView } = useInView<HTMLDivElement>({ amount: 0.15, once: true })
  const reduced = useReducedMotion()
  const shown = inView || reduced
  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay * 80}ms` } as CSSProperties}
      className={cn('transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]', shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0', className)}
    >
      {children}
    </Tag>
  )
}
