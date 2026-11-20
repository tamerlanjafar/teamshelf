import { useEffect, useState } from 'react'

/**
 * Counts down from `seconds` to 0, once a second. `restart()` starts it over.
 * Returns the seconds that are left.
 */
export function useCountdown(seconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))

  const running = left > 0

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running, endsAt])

  const restart = () => {
    setNow(Date.now())
    setEndsAt(Date.now() + seconds * 1000)
  }
  return { left, restart }
}
