import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { RotateCw, TriangleAlert } from 'lucide-react'
import { Component, Suspense, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'

interface BoundaryProps {
  /** Called when the person asks to try again, before the children are drawn anew. */
  onReset: () => void
  fallback: (error: unknown, retry: () => void) => ReactNode
  children: ReactNode
}

/** Catches what its children throw while rendering, and draws the fallback in their place. */
class ErrorBoundary extends Component<BoundaryProps, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false }

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }

  retry = () => {
    this.props.onReset()
    this.setState({ error: null, failed: false })
  }

  render() {
    return this.state.failed ? this.props.fallback(this.state.error, this.retry) : this.props.children
  }
}

/**
 * A part of a page that loads its own data. While it loads it shows `skeleton`. If loading
 * fails, only this part shows the problem, with a button to load it again. The rest of the
 * page keeps working.
 */
export function Section({ skeleton, compact = false, children }: { skeleton: ReactNode; compact?: boolean; children: ReactNode }) {
  const { reset } = useQueryErrorResetBoundary()
  return (
    <ErrorBoundary onReset={reset} fallback={(error, retry) => <SectionError error={error} compact={compact} onRetry={retry} />}>
      <Suspense fallback={skeleton}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function SectionError({ error, compact, onRetry }: { error: unknown; compact: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className={compact ? 'bg-raised border-line flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3.5' : 'mx-auto flex max-w-sm flex-col items-center gap-2 pt-[14vh] text-center'}>
      <TriangleAlert className={compact ? 'text-danger size-5 flex-none' : 'text-danger size-9'} strokeWidth={1.6} />
      <div className={compact ? 'min-w-[180px] flex-1' : ''}>
        <div className={compact ? 'font-medium' : 'mt-2 text-[20px] font-[650] [font-family:var(--font-rounded)]'}>This part couldn't be loaded</div>
        <p className="text-quiet m-0 mt-0.5 leading-relaxed">{errorMessage(error)}</p>
      </div>
      <Button variant="outline" onClick={onRetry} className={compact ? '' : 'mt-3'}>
        <RotateCw />
        Reload
      </Button>
    </div>
  )
}

/** A boundary for a whole screen: the same idea as <Section>, with a full-page fallback. */
export function ScreenBoundary({ loading, failed, children }: { loading: ReactNode; failed: (error: unknown, retry: () => void) => ReactNode; children: ReactNode }) {
  const { reset } = useQueryErrorResetBoundary()
  return (
    <ErrorBoundary onReset={reset} fallback={failed}>
      <Suspense fallback={loading}>{children}</Suspense>
    </ErrorBoundary>
  )
}

/** Rows of a list on a sheet, while they load. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="bg-raised border-line divide-line divide-y overflow-hidden rounded-[14px] border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <span className="bg-ink/8 size-8 flex-none animate-pulse rounded-full" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="bg-ink/8 h-3 w-2/5 animate-pulse rounded-full" />
            <span className="bg-ink/6 h-2.5 w-3/5 animate-pulse rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}
