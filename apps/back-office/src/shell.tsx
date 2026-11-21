import { Link, Outlet } from '@tanstack/react-router'
import { Building2, HardDrive, LayoutDashboard, LogOut, RotateCw } from 'lucide-react'
import { createContext, useContext, useState, type FormEvent } from 'react'
import { Field } from '@base-ui/react/field'
import { sendSignInLink, signOut, useSession } from '@/backend'
import { BUTTON, Notice, QUIET_BUTTON } from '@/components/parts'
import { ago } from '@/lib/format'
import type { Report } from '@/report'
import { useReportQuery } from '@/use-report'

const ReportContext = createContext<Report | null>(null)

/** The report, on any page inside the back office. */
export function useReport(): Report {
  const report = useContext(ReportContext)
  if (!report) throw new Error('useReport is for pages inside the back office.')
  return report
}

const PAGES = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/organizations', label: 'Organizations', icon: Building2 },
  { to: '/storage', label: 'File storage', icon: HardDrive },
] as const

/**
 * The frame of the back office, and its door: signing in, then the report, which the database
 * gives to super admins only. Everyone else is told so, and sees nothing.
 */
export function Shell() {
  const session = useSession()
  if (session.state === 'loading') return <Loading />
  if (session.state === 'signed-out') return <SignIn />
  return <SignedIn email={session.email} />
}

const Loading = () => (
  <main aria-busy="true" aria-label="Loading" className="grid min-h-dvh place-items-center">
    <span className="border-line border-t-brand size-7 animate-spin rounded-full border-2" />
  </main>
)

function SignedIn({ email }: { email: string }) {
  const report = useReportQuery()

  if (report.isPending) return <Loading />
  if (report.isError)
    return (
      <Notice title="The report couldn't be loaded" text={report.error.message}>
        <button type="button" className={BUTTON} onClick={() => void report.refetch()}>
          Try again
        </button>
      </Notice>
    )
  if (report.data === false)
    return (
      <Notice title="This isn't for you" text={`${email} isn't a super admin of this Teamshelf. Sign in with an email that is.`}>
        <button type="button" className={BUTTON} onClick={() => void signOut()}>
          Sign out
        </button>
      </Notice>
    )

  return (
    <ReportContext value={report.data}>
      <div className="mx-auto grid max-w-[1180px] gap-x-8 px-4 md:grid-cols-[200px_minmax(0,1fr)] md:px-6">
        <aside className="flex flex-col gap-5 py-5 md:sticky md:top-0 md:h-dvh">
          <div>
            <div className="text-[19px] font-bold tracking-[-0.04em]">
              team<span className="text-[#fa8c29]">/</span>shelf
            </div>
            <div className="text-quiet text-[12.5px]">Back office</div>
          </div>
          <nav aria-label="Reports" className="flex gap-1 max-md:overflow-x-auto md:flex-col">
            {PAGES.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                activeOptions={{ exact: true, includeSearch: false }}
                className="text-quiet hover:text-ink hover:bg-ink/5 flex flex-none items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium"
                activeProps={{ className: 'bg-surface text-ink! shadow-[0_1px_2px_hsl(var(--shadow)/0.08)]' }}
              >
                <page.icon className="size-[17px]" />
                {page.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto grid gap-2 max-md:hidden">
            <div className="text-quiet truncate text-[12.5px]" title={email}>
              {email}
            </div>
            <button type="button" className={QUIET_BUTTON} onClick={() => void signOut()}>
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-w-0 pt-2 pb-16 md:pt-7">
          <Outlet />
          <footer className="text-quiet mt-10 flex flex-wrap items-center gap-3 text-[12.5px]">
            <span>Numbers as of {ago(report.data.generated_at)}, {new Date(report.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
            <button type="button" className="hover:text-ink inline-flex items-center gap-1.5 font-medium" disabled={report.isFetching} onClick={() => void report.refetch()}>
              <RotateCw className={report.isFetching ? 'size-3.5 animate-spin' : 'size-3.5'} />
              Refresh
            </button>
            <button type="button" className="hover:text-ink font-medium md:hidden" onClick={() => void signOut()}>
              Sign out
            </button>
          </footer>
        </main>
      </div>
    </ReportContext>
  )
}

/** Sign-in is by a link sent by email, as in the app. Anyone may ask for one; only a super admin gets further. */
function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [problem, setProblem] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setProblem('Enter a valid email address.')
    setState('sending')
    setProblem(null)
    try {
      await sendSignInLink(email)
      setState('sent')
    } catch (error) {
      setState('idle')
      setProblem(error instanceof Error ? error.message : 'The email could not be sent.')
    }
  }

  if (state === 'sent')
    return (
      <Notice title="Check your email" text={`Click the link we sent to ${email.trim().toLowerCase()} to sign in. It expires in 30 minutes.`}>
        <button type="button" className={QUIET_BUTTON} onClick={() => setState('idle')}>
          Use another email
        </button>
      </Notice>
    )

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} noValidate className="bg-surface grid w-full max-w-sm gap-4 rounded-2xl border p-6">
        <div>
          <h1 className="m-0 text-[22px] font-[650] [font-family:var(--font-rounded)]">Teamshelf back office</h1>
          <p className="text-quiet m-0 mt-1">Enter your email and we'll send you a link to sign in.</p>
        </div>
        <Field.Root invalid={Boolean(problem)} className="grid gap-1.5">
          <Field.Label className="text-[13px] font-medium">Email</Field.Label>
          <Field.Control
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setProblem(null)
            }}
            className="bg-well h-10 rounded-lg px-3 shadow-[inset_0_0_0_1px_var(--line)] outline-none focus:shadow-[inset_0_0_0_1px_var(--brand)] data-[invalid]:shadow-[inset_0_0_0_1px_var(--danger)]"
          />
          {problem && (
            <span role="alert" className="text-danger text-[12.5px]">
              {problem}
            </span>
          )}
        </Field.Root>
        <button type="submit" className={BUTTON} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
