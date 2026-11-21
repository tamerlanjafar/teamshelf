import { ArrowLeft } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { BrandMark, Wordmark } from '@/components/app/brand'
import { Button } from '@/components/ui/button'

/**
 * The frame of every screen you see outside an organization: signing in, choosing or creating
 * an organization, and the messages when something isn't yours to open.
 *
 * The left column holds the wordmark (in the panel instead, on wide screens) and the form: an optional way back, a
 * title (with an icon beside it, if any), a line or two, and the screen's own content, all on one left edge, centered. On wide screens a panel on the right shows what
 * Teamshelf is, a shelf of link cards. Phones get the form alone.
 */
export function AuthCard({
  icon,
  title,
  description,
  back,
  children,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  back?: { label: string; onClick: () => void }
  children?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* The logo and the form together, centered, on one left edge. */}
      <main className="flex min-w-0 flex-col px-6 py-12 sm:px-10 lg:px-14">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
          <div>
            {/* Wide screens show the logo in the panel instead. */}
            <Wordmark className="mb-14 block w-fit text-[32px] lg:hidden" />
            {back && (
              <button type="button" onClick={back.onClick} className="text-quiet hover:text-ink -ml-1 mb-6 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13.5px] font-medium transition-colors">
                <ArrowLeft className="size-4" />
                {back.label}
              </button>
            )}
            <h1 className="m-0 text-[32px] leading-[1.12] font-[650] tracking-[-0.025em] text-balance [font-family:var(--font-rounded)] flex items-center gap-3">
              {icon && <span className="text-brand flex-none [&_svg]:size-[30px]">{icon}</span>}
              {title}
            </h1>
            {description && <div className="text-quiet mt-3 text-[15.5px] leading-relaxed text-pretty">{description}</div>}
            {children && <div className="mt-8 flex flex-col gap-3">{children}</div>}
          </div>
        </div>
      </main>
      <ShelfPanel />
    </div>
  )
}

/** The size and shape of a button on these screens. */
export const AUTH_BUTTON = 'h-11 w-full rounded-xl text-[15px]'

/**
 * A secondary button on these screens: white on the page, and on hover a darker edge rather than
 * the grey fill an outline button gets elsewhere, which looks darker than this page.
 */
export const AUTH_SECONDARY = `${AUTH_BUTTON} bg-surface border-line hover:bg-surface! hover:border-[color-mix(in_srgb,var(--ink)_22%,transparent)] dark:bg-surface dark:hover:bg-surface!`

/** The size and shape of a text field on these screens. */
export const AUTH_INPUT = 'bg-surface! border-line h-11 rounded-xl border px-3.5 text-[15px] shadow-[0_1px_2px_hsl(var(--shadow)/0.05)]'

/** For an email address or a name inside a description. */
export function Strong({ children }: { children: ReactNode }) {
  return <span className="text-ink font-medium wrap-break-word">{children}</span>
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

// ---- The panel ------------------------------------------------------------------------------

interface Card {
  name: string
  tint: string
  rows: { name: string }[]
}

/** A made-up board, in columns, the way a team's space looks. */
const COLUMNS: Card[][] = [
  [
    { name: 'Web Apps', tint: '#337afa', rows: [{ name: 'Customer portal' }, { name: 'Public API' }, { name: 'Mobile app' }, { name: 'Admin console' }] },
    { name: 'Docs', tint: '#fa8c29', rows: [{ name: 'Architecture.pdf' }, { name: 'Onboarding guide' }, { name: 'API reference' }] },
    { name: 'Access', tint: '#64748b', rows: [{ name: 'VPN setup' }, { name: 'Password vault' }] },
    { name: 'Security', tint: '#0ea5e9', rows: [{ name: 'Audit log' }, { name: 'Single sign-on' }] },
  ],
  [
    { name: 'Monitoring', tint: '#33bd66', rows: [{ name: 'Grafana' }, { name: 'Sentry' }, { name: 'Status page' }] },
    { name: 'Design', tint: '#e5539b', rows: [{ name: 'Figma' }, { name: 'Storybook' }] },
    { name: 'Support', tint: '#eab308', rows: [{ name: 'Help center' }, { name: 'Ticket queue' }, { name: 'Macros' }] },
    { name: 'Marketing', tint: '#f97316', rows: [{ name: 'Website editor' }, { name: 'Campaigns' }] },
  ],
  [
    { name: 'CI / CD', tint: '#8b5cf6', rows: [{ name: 'GitHub Actions' }, { name: 'Netlify' }, { name: 'Docker Hub' }] },
    { name: 'Data', tint: '#14b8a6', rows: [{ name: 'Metabase' }, { name: 'Mixpanel' }] },
    { name: 'Product', tint: '#ef4444', rows: [{ name: 'Roadmap' }, { name: 'Release notes' }] },
    { name: 'Finance', tint: '#22c55e', rows: [{ name: 'Invoices' }, { name: 'Expenses' }] },
  ],
]

/**
 * What Teamshelf is, without words to read first: a tilted shelf of link cards on the brand's
 * indigo, running off the edges, with the logo above and what it is for under it. The cards are
 * decoration, hidden from screen readers. The same in both themes.
 */
function ShelfPanel() {
  return (
    <aside className="relative m-3 hidden flex-col overflow-hidden rounded-2xl bg-[#16184a] lg:flex">
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_85%_5%,rgba(124,130,255,0.42),transparent),radial-gradient(55%_45%_at_0%_100%,rgba(90,96,230,0.22),transparent)]" />
      <Wordmark className="relative z-10 mx-12 mt-11 block w-fit flex-none text-[34px] text-white" />
      {/* The shelf takes the height left between the logo and the words, whatever the window's
          height, and fades out above the words. */}
      <div aria-hidden="true" className="relative min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
        <div className="absolute top-16 left-[10%] flex origin-top-left [transform:rotate(-5deg)] gap-5">
          {COLUMNS.map((column, index) => (
            <div key={index} className="flex w-[300px] flex-none flex-col gap-5" style={{ marginTop: index * 56 }}>
              {column.map((card) => (
                <ShelfCard key={card.name} card={card} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex-none px-12 pt-2 pb-12">
        <p className="m-0 text-[28px] leading-[1.15] font-[650] tracking-[-0.025em] text-white [font-family:var(--font-rounded)]">
          Your team's links and files, in one place.
        </p>
        <p className="m-0 mt-3 text-[15px] leading-relaxed text-pretty text-white/65">A space for each team, and anything found in seconds.</p>
      </div>
    </aside>
  )
}

function ShelfCard({ card }: { card: Card }) {
  return (
    <div
      className="rounded-2xl border border-white/60 p-3.5 shadow-[0_18px_40px_rgba(5,6,30,0.45)]"
      style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${card.tint} 14%, #fff) 0, #fff 56px)` } as CSSProperties}
    >
      <div className="mb-2 flex items-center gap-2 px-1 text-[15px] font-[650] text-[#13151d] [font-family:var(--font-rounded)]">
        <span className="size-2 rounded-full" style={{ background: card.tint }} />
        {card.name}
      </div>
      {card.rows.map((row) => (
        // As on the board (link-row.tsx): a line per link, its icon and its name.
        <div key={row.name} className="flex items-center gap-2.5 px-1 py-1.5 text-[13.5px] text-[#13151d]">
          <span className="grid size-5 flex-none place-items-center rounded-xs text-[9px] font-bold text-white" style={{ background: card.tint }}>
            {row.name[0]}
          </span>
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
        </div>
      ))}
    </div>
  )
}
