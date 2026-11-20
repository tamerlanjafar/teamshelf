import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { BrandMark, Wordmark } from '@/components/app/brand'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * The centered card of every screen you see outside an organization: signing in, choosing or
 * creating an organization, and the messages when something isn't yours to open.
 * The wordmark (or an icon), a title, a line or two under it, then the screen's own content.
 */
export function AuthCard({ icon, title, description, children }: { icon?: ReactNode; title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-[500px] gap-6 px-6 py-8 sm:px-12 sm:py-12">
        <CardHeader className="gap-6 p-0 text-center">
          {icon ?? <Wordmark className="mx-auto" />}
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-2xl font-medium">{title}</CardTitle>
            {description && <CardDescription className="text-sm leading-relaxed text-pretty">{description}</CardDescription>}
          </div>
        </CardHeader>
        {children && <CardContent className="flex flex-col gap-3 p-0">{children}</CardContent>}
      </Card>
    </main>
  )
}

/** The size and shape of a button on these cards. */
export const AUTH_BUTTON = 'h-10 w-full rounded-lg'

/** For an email address or a name inside a card's description. */
export function Strong({ children }: { children: ReactNode }) {
  return <span className="text-card-foreground font-medium wrap-break-word">{children}</span>
}

/** While the session is being checked. Nothing to read, so nothing flashes. */
export function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center" aria-busy="true" aria-label="Loading">
      <BrandMark loading className="size-12" />
    </main>
  )
}

export function LoadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <AuthCard title="Teamshelf couldn't load" description={message}>
      <Button size="lg" className={AUTH_BUTTON} onClick={onRetry}>
        Try again
      </Button>
    </AuthCard>
  )
}
