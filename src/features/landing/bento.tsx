import { BarChart3, Briefcase, Check, Code2, Eye, EyeOff, FileText, GripVertical, Lock, Palette } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Wordmark } from '@/components/app/brand'
import { COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { Reveal, useLoop } from './motion'

/** One card of the grid: a small live demo in a tinted well, then what it is. */
function Tile({ title, text, tint, children, className, delay = 0 }: { title: string; text: string; tint: string; children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn('bg-page border-line flex min-w-0 flex-col gap-5 rounded-[20px] border p-4 transition-colors hover:border-[color-mix(in_srgb,var(--ink)_18%,transparent)]', className)}>
      {/* The demo sits in the middle of its well, with the same room on every side. */}
      <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-[14px] border p-5" style={{ background: `color-mix(in srgb, ${tint} 7%, var(--surface))`, borderColor: `color-mix(in srgb, ${tint} 18%, transparent)` }}>
        <div className="w-full">{children}</div>
      </div>
      <div className="grid gap-1.5 px-1.5 pb-1.5">
        <h3 className="m-0 text-[16.5px] font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="text-quiet m-0 text-[14px] leading-relaxed">{text}</p>
      </div>
    </Reveal>
  )
}

const SPACES = [
  { name: 'Development', icon: <Code2 />, color: COLORS.indigo },
  { name: 'Design', icon: <Palette />, color: COLORS.pink },
  { name: 'Data', icon: <BarChart3 />, color: COLORS.teal },
  { name: 'Leadership', icon: <Briefcase />, color: COLORS.purple, locked: true },
]

/** The sidebar's spaces, one after the other in use. */
function SpacesDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(SPACES.length, 1500, 0)
  return (
    <div ref={ref} aria-hidden="true" className="grid gap-1">
      {SPACES.map((space, index) => (
        <div key={space.name} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-[5px] text-[13.5px] transition-[background-color,box-shadow] duration-300', index === step ? 'bg-surface font-semibold shadow-[0_1px_3px_hsl(var(--shadow)/0.14)]' : 'text-quiet')}>
          <span className="grid size-6 place-items-center rounded-md text-white [&_svg]:size-3.5" style={{ background: space.color }}>
            {space.icon}
          </span>
          <span className="flex-1">{space.name}</span>
          {space.locked && <Lock className="size-3.5 opacity-70" />}
        </div>
      ))}
    </div>
  )
}

/** A suggestion arriving, approved, and on its way to the board. */
function SuggestDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(7, 900, 3)
  const shown = step >= 1 && step <= 5
  const approved = step >= 4
  return (
    <div ref={ref} aria-hidden="true" className="flex h-full flex-col justify-center">
      <div className={cn('bg-surface border-line rounded-xl border p-3 shadow-[0_6px_20px_-10px_hsl(var(--shadow)/0.35)] transition-[opacity,translate] duration-500', shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}>
        <div className="flex items-center gap-2.5">
          <span className="bg-well grid size-8 place-items-center rounded-lg text-[11px] font-bold">P</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13.5px] font-semibold">Postman</p>
            <p className="text-quiet m-0 truncate text-[12px]">Development › Tools · Mina Park</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <span
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold transition-colors duration-300',
              approved ? 'bg-[color-mix(in_srgb,#33bd66_16%,transparent)] text-[color-mix(in_srgb,#33bd66_70%,var(--ink))]' : step === 3 ? 'bg-brand text-on-brand scale-95' : 'bg-brand text-on-brand',
            )}
          >
            <Check className="size-3.5" strokeWidth={3} />
            {approved ? 'On the board' : 'Approve'}
          </span>
        </div>
      </div>
    </div>
  )
}

const AUDIENCE = [
  { label: 'Everyone', line: 'Everyone in Development sees it.' },
  { label: 'Admins', line: 'Only admins of Development see it.' },
  { label: 'Chosen', line: 'Only Sam, Priya and the admins.' },
]

/** Who can see a link, switching from everyone to a chosen few. */
function AudienceDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(AUDIENCE.length, 1800, 2)
  return (
    <div ref={ref} aria-hidden="true" className="flex h-full flex-col justify-center gap-3">
      <div className="bg-well grid grid-cols-3 gap-0.5 rounded-lg p-[3px] shadow-[inset_0_0_0_1px_var(--line)]">
        {AUDIENCE.map((option, index) => (
          <span key={option.label} className={cn('rounded-md px-1 py-1 text-center text-[11.5px] whitespace-nowrap transition-colors duration-300', index === step ? 'bg-chip font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.15)]' : 'text-quiet')}>
            {option.label}
          </span>
        ))}
      </div>
      <p key={step} className="text-quiet m-0 animate-[fade-in_0.3s_ease-out] text-[12.5px]">
        {AUDIENCE[step].line}
      </p>
      <div className="flex items-center gap-1.5">
        {['SL', 'PN', 'AM'].map((initials, index) => (
          <span
            key={initials}
            className={cn('bg-brand/15 text-brand grid size-7 place-items-center rounded-full text-[10.5px] font-bold transition-opacity duration-300', step === 0 || (step === 2 && index < 3) || (step === 1 && index === 2) ? 'opacity-100' : 'opacity-25')}
          >
            {initials}
          </span>
        ))}
        <Lock className={cn('text-quiet ml-1 size-3.5 transition-opacity', step === 0 ? 'opacity-0' : 'opacity-100')} />
      </div>
    </div>
  )
}

/** A file uploading, then sitting on the card like any link. */
function FileDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(10, 350, 9)
  const progress = Math.min(100, step * 16)
  const done = progress >= 100
  return (
    <div ref={ref} aria-hidden="true" className="flex h-full flex-col justify-center">
      <div className="bg-surface border-line rounded-xl border p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,#fa8c29_14%,transparent)] text-[#fa8c29]">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13.5px] font-semibold">Architecture.pdf</p>
            <p className="text-quiet m-0 text-[12px] tabular-nums">{done ? '2.3 MB' : `Uploading ${progress}%`}</p>
          </div>
          {done && <Check className="size-4 animate-[pop-in_0.25s_ease-out] text-[#33bd66]" strokeWidth={3} />}
        </div>
        <div className="bg-ink/8 mt-3 h-1.5 overflow-hidden rounded-full">
          <div className={cn('h-full rounded-full transition-[width] duration-300', done ? 'bg-[#33bd66]' : 'bg-brand')} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}

const ORGS = [
  { name: 'Acme', email: 'alex@acme.com', color: COLORS.indigo },
  { name: 'Lumen Labs', email: 'alex@lumenlabs.dev', color: COLORS.teal },
  { name: 'Orbit', email: 'alex@orbit.example', color: COLORS.orange },
]

/** The organization switcher, moving between organizations signed in with different emails. */
function OrgsDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(ORGS.length, 1700, 0)
  return (
    <div ref={ref} aria-hidden="true" className="bg-surface border-line grid gap-0.5 rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_hsl(var(--shadow)/0.35)]">
      {ORGS.map((org, index) => (
        <div key={org.name} className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-300', index === step && 'bg-[color-mix(in_srgb,var(--brand)_9%,transparent)]')}>
          <span className="grid size-7 place-items-center rounded-md text-[11px] font-bold text-white" style={{ background: org.color }}>
            {org.name[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold">{org.name}</span>
            <span className="text-quiet block truncate text-[11.5px]">{org.email}</span>
          </span>
          <Check className={cn('text-brand size-4 transition-opacity', index === step ? 'opacity-100' : 'opacity-0')} strokeWidth={3} />
        </div>
      ))}
    </div>
  )
}

const LINKS = ['Grafana', 'Old wiki', 'Sentry']

/** Hiding a link you never use: it fades from your board, and only yours. */
function HideDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(6, 800, 3)
  const hidden = step >= 2 && step <= 4
  return (
    <div ref={ref} aria-hidden="true" className="bg-surface border-line rounded-xl border p-2" style={{ '--c': COLORS.green } as CSSProperties}>
      <p className="m-0 px-2 pt-0.5 pb-1.5 text-[13px] font-bold text-[color-mix(in_srgb,var(--c)_70%,var(--ink))]">Monitoring</p>
      {LINKS.map((link, index) => {
        const target = index === 1
        return (
          <div
            key={link}
            className={cn(
              'flex items-center gap-2 overflow-hidden rounded-md px-2 text-[13px] transition-[max-height,opacity,padding] duration-500',
              target && hidden ? 'max-h-0 py-0 opacity-0' : 'max-h-8 py-1 opacity-100',
              target && step === 1 && 'bg-[color-mix(in_srgb,var(--c)_14%,transparent)]',
            )}
          >
            <span className="size-3.5 rounded-[4px]" style={{ background: `color-mix(in srgb, ${COLORS.green} ${30 + index * 15}%, transparent)` }} />
            <span className="flex-1">{link}</span>
            {target && (step === 1 ? <EyeOff className="text-quiet size-3.5" /> : <Eye className="text-quiet size-3.5 opacity-0" />)}
          </div>
        )
      })}
    </div>
  )
}

/** Two columns of cards, their shared edge dragged back and forth. */
function ShapeDemo() {
  const { ref, step } = useLoop<HTMLDivElement>(2, 1800, 0)
  const wide = step === 1
  const card = (name: string, color: string, rows: number) => (
    <div className="bg-surface border-line rounded-lg border p-2.5" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${color} 12%, var(--surface)), var(--surface) 40px)` }}>
      <p className="m-0 mb-1.5 text-[12.5px] font-bold" style={{ color: `color-mix(in srgb, ${color} 75%, var(--ink))` }}>
        {name}
      </p>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="bg-ink/8 mt-1.5 block h-2 rounded-full" style={{ width: `${85 - index * 14}%` }} />
      ))}
    </div>
  )
  return (
    <div ref={ref} aria-hidden="true" className="flex gap-2.5">
      <div className="flex min-w-0 flex-col gap-2.5 transition-[flex-grow] duration-700 ease-in-out" style={{ flexGrow: wide ? 3 : 2 }}>
        {card('Web app', COLORS.blue, 2)}
        {card('Docs', COLORS.orange, 1)}
      </div>
      <div className="relative flex w-2 flex-none items-center justify-center self-stretch">
        <span className="bg-brand h-10 w-1 rounded-full" />
        <GripVertical className="text-brand absolute size-3.5 opacity-0" />
      </div>
      <div className="flex min-w-0 flex-col gap-2.5 transition-[flex-grow] duration-700 ease-in-out" style={{ flexGrow: wide ? 2 : 3 }}>
        {card('Monitoring', COLORS.green, 1)}
        {card('CI / CD', COLORS.purple, 2)}
      </div>
    </div>
  )
}

/** Everything else Teamshelf does, as a grid of small live demos around a short introduction. */
export function Bento({ actions }: { actions: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Reveal className="bg-page border-line flex flex-col justify-between gap-10 rounded-[20px] border p-7 sm:col-span-2 lg:row-span-2 lg:p-9">
        <div className="grid gap-4">
          <h2 className="m-0 text-[clamp(30px,3.6vw,44px)] leading-[1.06] font-[650] tracking-[-0.03em] text-balance [font-family:var(--font-rounded)]">The shelf your team reaches for every day</h2>
          <p className="text-quiet m-0 max-w-md text-[16px] leading-relaxed">Spaces for each team, links and files in tidy cards, and the right people in each. It stays organized because everyone helps and admins decide.</p>
        </div>
        <div className="grid gap-6">
          <ul className="divide-line m-0 list-none divide-y p-0">
            {['Sign in with a link by email, no passwords', 'Light and dark, on any screen', 'Set up in about a minute'].map((point) => (
              <li key={point} className="flex items-center gap-3 py-3 text-[14.5px]">
                <span className="bg-brand text-on-brand grid size-5 flex-none place-items-center rounded-full">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            {actions}
            <Wordmark className="text-quiet/60 ml-auto text-[18px] max-sm:hidden" />
          </div>
        </div>
      </Reveal>
      <Tile delay={1} tint={COLORS.indigo} title="A space for every team" text="Open to everyone, or private to the people you add.">
        <SpacesDemo />
      </Tile>
      <Tile delay={2} tint={COLORS.green} title="Anyone suggests" text="Admins of each space approve, so boards stay clean.">
        <SuggestDemo />
      </Tile>
      <Tile delay={1} tint={COLORS.purple} title="Links for a few" text="Show a link to everyone, to admins, or to people you pick.">
        <AudienceDemo />
      </Tile>
      <Tile delay={2} tint={COLORS.orange} title="Files too" text="PDFs and docs up to 25 MB sit next to your links.">
        <FileDemo />
      </Tile>
      <Tile delay={1} tint={COLORS.teal} title="Several organizations" text="Stay signed in to each, with the email you use there.">
        <OrgsDemo />
      </Tile>
      <Tile delay={2} tint={COLORS.green} title="Your own view" text="Hide what you never use. Only your board changes.">
        <HideDemo />
      </Tile>
      <Tile delay={3} tint={COLORS.blue} title="Shape the board" text="Drag cards anywhere, resize them and their columns." className="sm:col-span-2">
        <ShapeDemo />
      </Tile>
    </div>
  )
}
