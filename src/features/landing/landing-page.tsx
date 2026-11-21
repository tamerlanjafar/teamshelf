import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Command, Inbox, Search, ShieldCheck, Users } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { Wordmark } from '@/components/app/brand'
import { savedAccounts } from '@/lib/accounts'
import { cn } from '@/lib/utils'
import { Bento } from './bento'
import { Reveal } from './motion'
import { Showcase } from './showcase'

/** Whether this browser is signed in to an organization: then the page offers to open the app. */
const signedIn = () => {
  try {
    return savedAccounts().some((account) => account.slots.length > 0)
  } catch {
    return false
  }
}

const YEAR = new Date().getFullYear()

/** A link to a section that glides there (or jumps, for people who turned motion off). */
const scrollTo = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  const section = document.getElementById(id)
  if (!section) return
  event.preventDefault()
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // The address stays as it is: changing its #part makes the router jump there at once.
  section.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}

const PRIMARY =
  'bg-brand text-on-brand inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold shadow-[0_1px_2px_hsl(var(--shadow)/0.15),0_6px_18px_-6px_color-mix(in_srgb,var(--brand)_55%,transparent)] transition-[transform,filter] hover:brightness-110 active:scale-[0.98]'
const SECONDARY =
  'bg-surface text-ink border-line inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-[15px] font-semibold transition-colors hover:border-[color-mix(in_srgb,var(--ink)_25%,transparent)]'
const HEADING = 'font-[650] tracking-[-0.035em] text-balance [font-family:var(--font-rounded)]'
const GUTTER = 'px-[max(16px,env(safe-area-inset-left))]'

/**
 * Teamshelf's front page, at teamshelf.app, for everyone. It shows the product: setting it up,
 * the app itself (screenshots from mock mode, in the viewer's theme), and what each part does.
 * Signed out it offers creating an organization and signing in; signed in, opening the app.
 */
export function LandingPage() {
  const returning = signedIn()
  return (
    <div className="text-ink min-h-dvh overflow-x-clip">
      <Header returning={returning} />
      <main>
        <Hero returning={returning} />
        <Spotlights />
        {/* Everything else, in a band of its own, so it reads apart from the panels above. */}
        <section id="features" className={cn(GUTTER, 'bg-surface border-line scroll-mt-0 border-y py-20 sm:py-28')}>
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-12 max-w-2xl text-center">
              <span className="border-line bg-page rounded-full border px-3 py-1 text-[13px] font-medium">Features</span>
              <h2 className={cn(HEADING, 'm-0 mt-5 text-[clamp(30px,4vw,46px)] leading-[1.08]')}>Everything a shared shelf needs</h2>
              <p className="text-quiet m-0 mt-4 text-[17px] leading-relaxed">Small things that keep a team's links in order, and out of the way.</p>
            </Reveal>
            <Bento actions={<Actions returning={returning} />} />
          </div>
        </section>
        <Steps />
        <Closing returning={returning} />
      </main>
      <Footer />
    </div>
  )
}

/** The way in: open the app when signed in, otherwise create an organization or sign in. */
function Actions({ returning, small = false }: { returning: boolean; small?: boolean }) {
  const size = small && 'h-9 rounded-lg px-4 text-[14px]'
  if (returning)
    return (
      <Link to="/open" className={cn(PRIMARY, size, 'group')}>
        Open Teamshelf
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  return (
    // Stacked to full width on a phone, side by side from there.
    <div className="grid w-full gap-2.5 sm:flex sm:w-auto sm:items-center">
      <Link to="/login" search={{ intent: 'create' }} className={cn(PRIMARY, size, 'group')}>
        Create an organization
        {!small && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </Link>
      <Link to="/login" className={cn(SECONDARY, size, small && 'border-transparent bg-transparent px-3 hover:border-transparent hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]')}>
        Sign in
      </Link>
    </div>
  )
}

function Header({ returning }: { returning: boolean }) {
  return (
    <header className={GUTTER}>
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-4 sm:gap-8">
        <Link to="/" aria-label="Teamshelf home" className="rounded-md">
          <Wordmark className="text-[24px]" />
        </Link>
        <nav className="text-quiet hidden items-center gap-7 text-[14.5px] font-medium md:flex">
          {[
            ['product', 'Product'],
            ['features', 'Features'],
            ['how', 'How it works'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={scrollTo(id)} className="hover:text-ink transition-colors">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {returning ? (
            <Link to="/open" className={cn(PRIMARY, 'group h-9 rounded-lg px-4 text-[14px]')}>
              Open Teamshelf
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-ink hover:text-brand rounded-lg px-3.5 py-2 text-[14.5px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_9%,transparent)]">
                Sign in
              </Link>
              <Link to="/login" search={{ intent: 'create' }} className={cn(PRIMARY, 'h-9 rounded-lg px-3.5 text-[14px] whitespace-nowrap sm:px-4')}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/** A screenshot in both themes: the one for the viewer's theme shows. */
function Shot({ name, alt, className, eager = false }: { name: string; alt: string; className?: string; eager?: boolean }) {
  const loading = eager ? 'eager' : 'lazy'
  return (
    <>
      <img src={`/landing/${name}-light.webp`} alt={alt} className={cn('block w-full dark:hidden', className)} loading={loading} decoding="async" />
      <img src={`/landing/${name}-dark.webp`} alt={alt} className={cn('hidden w-full dark:block', className)} loading={loading} decoding="async" />
    </>
  )
}

/**
 * The top of the page: a faint grid behind a centered title, the way in, and the app itself.
 */
function Hero({ returning }: { returning: boolean }) {
  return (
    <section className={cn(GUTTER, 'relative pt-12 sm:pt-20')}>
      {/* The grid, fading out toward the edges and the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]"
      />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <h1 className={cn(HEADING, 'm-0 text-[clamp(40px,6.6vw,72px)] leading-[1.02]')}>
          Every link your team needs,{' '}
          <span className="relative whitespace-nowrap">
            <span className="relative z-10">on one shelf.</span>
            <svg aria-hidden="true" viewBox="0 0 300 16" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-3 w-full text-[#fa8c29] sm:h-4">
              <path d="M3 11 C 70 4, 150 3, 297 8" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="text-quiet m-0 mt-6 max-w-2xl text-[clamp(16px,1.8vw,19px)] leading-relaxed text-pretty">
          Teamshelf gives each team a space for its tools, docs and files. Anyone finds what they need in a keystroke, and admins keep it tidy.
        </p>
        <div className="mt-9 w-full sm:w-auto">
          <Actions returning={returning} />
        </div>
      </Reveal>

      <div id="product" className="relative mx-auto mt-14 max-w-6xl scroll-mt-6 pb-8 sm:mt-16">
        <Reveal delay={2} className="relative">
          <Showcase shot={<Shot name="board" eager alt="A team's space in Teamshelf: the spaces and the organization switcher in a sidebar, and cards of links grouped by topic." />} />
        </Reveal>
      </div>
    </section>
  )
}

/** A product part told in a muted panel: what it does on one side, the real screen on the other. */
function Spotlight({ icon, eyebrow, title, text, points, shot, alt, flip = false }: { icon: ReactNode; eyebrow: string; title: string; text: string; points: { title: string; text: string }[]; shot: string; alt: string; flip?: boolean }) {
  return (
    <Reveal className="bg-well/70 border-line grid overflow-hidden rounded-[26px] border p-2 md:grid-cols-2">
      <div className={cn('flex flex-col justify-center gap-7 p-6 sm:p-9 lg:p-12', flip && 'md:order-2')}>
        <div className="grid gap-3">
          <span className="text-brand flex items-center gap-2 text-[13px] font-semibold [&_svg]:size-4">
            {icon}
            {eyebrow}
          </span>
          <h3 className={cn(HEADING, 'm-0 text-[clamp(26px,2.8vw,34px)] leading-[1.1]')}>{title}</h3>
          <p className="text-quiet m-0 text-[16px] leading-relaxed">{text}</p>
        </div>
        <ul className="m-0 grid list-none gap-3.5 p-0">
          {points.map((point) => (
            <li key={point.title} className="flex items-start gap-3 text-[15px] leading-relaxed">
              <span className="bg-brand text-on-brand mt-[3px] grid size-5 flex-none place-items-center rounded-full">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="text-quiet">
                <span className="text-ink font-semibold">{point.title}.</span> {point.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn('bg-surface border-line grid min-h-[260px] place-items-center overflow-hidden rounded-[20px] border p-4 sm:p-8', flip && 'md:order-1')}>
        <div className="border-line w-full overflow-hidden rounded-xl border shadow-[0_18px_40px_-24px_hsl(var(--shadow)/0.45)]">
          <Shot name={shot} alt={alt} />
        </div>
      </div>
    </Reveal>
  )
}

function Spotlights() {
  return (
    <section className={cn(GUTTER, 'py-20 sm:py-28')}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="border-line bg-surface rounded-full border px-3 py-1 text-[13px] font-medium">How teams use it</span>
          <h2 className={cn(HEADING, 'm-0 mt-5 text-[clamp(30px,4vw,46px)] leading-[1.08]')}>Find it fast, keep it tidy, share it right</h2>
          <p className="text-quiet m-0 mt-4 text-[17px] leading-relaxed">No more digging through chats, bookmarks and old wiki pages for the link everyone needs.</p>
        </Reveal>
        <div className="grid gap-5">
          <Spotlight
            icon={<Search />}
            eyebrow="Quick find"
            title="Press / and it's there"
            text="Search every link and file of the space from anywhere on the board, without leaving the page."
            points={[
              { title: 'Finds anything', text: 'By name, group or address, as you type.' },
              { title: 'Back to recent links', text: 'The ones you opened lately are one keystroke away.' },
            ]}
            shot="search"
            alt="Quick find open over a board, listing the links that match a search."
          />
          <Spotlight
            flip
            icon={<Inbox />}
            eyebrow="Suggestions"
            title="Anyone suggests, admins decide"
            text="Everyone can add the links they find useful. The space's admins approve them, fix the name first, or say why not."
            points={[
              { title: 'One clear queue', text: 'Everything waiting for you, with where it would go.' },
              { title: 'Tidy names', text: 'Every link follows the same naming rules, checked as you type.' },
            ]}
            shot="suggestions"
            alt="Suggested links waiting for approval, each showing its space and group."
          />
          <Spotlight
            icon={<Users />}
            eyebrow="People"
            title="The right people in every space"
            text="Invite by email, or let anyone with your company's domain join on their own. Each space has its own admins and members."
            points={[
              { title: 'Guests need approval', text: 'People from outside your domain wait for an Org Admin.' },
              { title: 'Always an admin', text: 'An organization and each space always keep one.' },
            ]}
            shot="team"
            alt="The team page: an invitation waiting for approval, and everyone with their spaces and roles."
          />
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: <Command />, title: 'Create your organization', text: 'Pick a name and an address, like teamshelf.app/acme.' },
  { icon: <Inbox />, title: 'Add spaces and links', text: 'A space for each team, with cards of links and files.' },
  { icon: <ShieldCheck />, title: 'Invite your team', text: 'By email, or let everyone at your domain join on their own.' },
]

function Steps() {
  return (
    <section id="how" className={cn(GUTTER, 'scroll-mt-6 py-20 sm:py-28')}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className={cn(HEADING, 'm-0 text-[clamp(28px,3.4vw,40px)] leading-[1.1]')}>Up and running in minutes</h2>
          <p className="text-quiet m-0 mt-3 text-[16.5px]">Three steps, and your team has one place for everything.</p>
        </Reveal>
        {/* A path through the three steps: each one a node on a line, the line running to the next. */}
        <ol className="relative m-0 mt-14 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute top-6 right-[16.6%] left-[16.6%] hidden h-px bg-[linear-gradient(90deg,var(--brand)_0_50%,transparent_50%)] bg-[length:10px_1px] opacity-40 md:block" />
          <span aria-hidden="true" className="absolute top-0 bottom-0 left-6 w-px bg-[linear-gradient(180deg,var(--brand)_0_50%,transparent_50%)] bg-[length:1px_10px] opacity-40 md:hidden" />
          {STEPS.map((step, index) => (
            <Reveal as="li" delay={index} key={step.title} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
              <span className="bg-surface text-brand border-line relative grid size-12 flex-none place-items-center rounded-2xl border shadow-[0_0_0_6px_var(--page),0_6px_16px_-8px_hsl(var(--shadow)/0.35)] [&_svg]:size-5">{step.icon}</span>
              <div className="pt-1 md:pt-0">
                <h3 className="m-0 text-[17px] font-semibold">{step.title}</h3>
                <p className="text-quiet m-0 mt-1.5 max-w-[30ch] text-[15px] leading-relaxed md:mx-auto">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Closing({ returning }: { returning: boolean }) {
  return (
    <section className={cn(GUTTER, 'py-16 sm:py-24')}>
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#16184a] px-6 py-14 text-center sm:px-12 sm:py-20">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_0%,rgba(124,130,255,0.45),transparent),radial-gradient(50%_70%_at_0%_100%,rgba(250,140,41,0.18),transparent)]" />
        <div className="relative flex flex-col items-center">
          <h2 className={cn(HEADING, 'm-0 max-w-2xl text-[clamp(30px,4.4vw,50px)] leading-[1.06] text-white')}>Give your team one place for every link</h2>
          <p className="m-0 mt-4 max-w-lg text-[16.5px] leading-relaxed text-white/70">Set up your first space today. The next time someone asks for a link, it's already there.</p>
          <div className="mt-8 grid w-full gap-2.5 sm:flex sm:w-auto sm:justify-center">
            {returning ? (
              <Link to="/open" className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-[#16184a] transition-transform active:scale-[0.98]">
                Open Teamshelf
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" search={{ intent: 'create' }} className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-[#16184a] transition-transform active:scale-[0.98]">
                  Create an organization
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link to="/login" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/25 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  return (
    <footer className={cn(GUTTER, 'border-line border-t py-8')}>
      {/* Stacked on a phone, one line from there. */}
      <div className="text-quiet mx-auto flex max-w-6xl flex-col gap-2 text-[13.5px] sm:flex-row sm:items-center sm:gap-4">
        <Wordmark className="text-ink w-fit text-[18px]" />
        <span>Your team's links and files, in one place.</span>
        <span className="tabular-nums sm:ml-auto">© {YEAR} Teamshelf</span>
      </div>
    </footer>
  )
}
