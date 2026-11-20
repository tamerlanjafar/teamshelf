import { cn } from '@/lib/utils'

/**
 * Linkboard's mark: a tile holding three cards of different heights, as on the board.
 * With `loading` the cards light up in turn. public/favicon.svg is the same drawing.
 */
export function BrandMark({ className, loading = false }: { className?: string; loading?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-[26px]', loading && 'splash-mark', className)}>
      <rect width="24" height="24" rx="6.5" fill="#4b50e6" />
      <rect className="card" x="4.5" y="5" width="4" height="14" rx="1.6" fill="#fff" />
      <rect className="card" x="10" y="5" width="4" height="8.5" rx="1.6" fill="#fff" opacity="0.85" />
      <rect className="card" x="15.5" y="5" width="4" height="11.5" rx="1.6" fill="#fff" opacity="0.7" />
    </svg>
  )
}
