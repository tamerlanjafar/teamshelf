import type { ReactNode } from 'react'

/** The app itself, whole and still, in a soft frame under the hero. */
export function Showcase({ shot }: { shot: ReactNode }) {
  return (
    <div className="bg-well/80 border-line rounded-[26px] border p-2 sm:p-3">
      <div className="border-line overflow-hidden rounded-[18px] border shadow-[0_24px_60px_-28px_hsl(var(--shadow)/0.45)]">{shot}</div>
    </div>
  )
}
