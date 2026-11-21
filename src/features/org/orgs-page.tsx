import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { ChevronRight, LogIn, LogOut, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSignedInOrgs, useSignOutEverywhere } from '@/api/accounts'
import { useJoinOrg, useMyOrgs } from '@/api/orgs'
import { Button } from '@/components/ui/button'
import { OrgBadge } from '@/components/app/org-badge'
import { AuthCard, Strong } from '@/features/auth/screens'
import { crossTo } from '@/lib/accounts'
import { errorMessage } from '@/lib/errors'
import { neon } from '@/lib/neon'
import type { OrgSummary } from '@/lib/types'

/**
 * Every organization signed in on this browser, each with the email it is signed in with, and
 * the ones this page's email may join. Then the two ways to another organization, which don't
 * depend on any of these: signing in to one with its email, and creating one.
 *
 * Suspends while the list loads, so it needs a boundary above it.
 */
export function OrgsPage() {
  const { orgs, joinable } = useMyOrgs()
  const signedIn = useSignedInOrgs()
  const signOutEverywhere = useSignOutEverywhere()
  const email = neon.auth.useSession().data?.user.email ?? ''
  // This page's email is in no organization: just signed in with it, or every one of them left.
  const lonely = orgs.length === 0 && joinable.length === 0
  const nothing = lonely && signedIn.length === 0

  return (
    <AuthCard
      title={nothing ? 'Welcome to Teamshelf' : 'Your organizations'}
      description={
        lonely ? (
          <>
            <Strong>{email}</Strong> isn't in an organization yet. Ask an admin to invite you, or:
          </>
        ) : undefined
      }
    >
      {signedIn.length > 0 && (
        <ul className={LIST}>
          {signedIn.map((org) => (
            <li key={org.slug}>
              {org.here ? (
                <Link to="/$org" params={{ org: org.slug }} className={ROW}>
                  <OrgRow name={org.name} detail={org.email} />
                </Link>
              ) : (
                // Another email's organization: the page loads again, with its session.
                <a href={`/${org.slug}`} className={ROW}>
                  <OrgRow name={org.name} detail={org.email} />
                </a>
              )}
            </li>
          ))}
          {/* Last in the list it affects, like an account chooser: quiet, red under the pointer. */}
          <li>
              <button type="button" onClick={signOutEverywhere} className="group text-quiet hover:text-danger flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_6%,transparent)]">
                <span className="grid h-5 w-9 flex-none place-items-center">
                  <LogOut className="size-4" />
                </span>
                {signedIn.length > 1 ? 'Sign out of all' : 'Sign out'}
              </button>
            </li>
        </ul>
      )}

      {/* Organizations this email's domain lets in: apart from the ones you are in, which sign-out is about. */}
      {joinable.length > 0 && (
        <section className={signedIn.length > 0 ? 'my-3' : 'mb-3'}>
          <h2 className="text-quiet m-0 mb-2 px-1 text-[12px] font-semibold tracking-[0.05em] uppercase">Available to join</h2>
          <ul className={LIST}>
            {joinable.map((org) => (
              <JoinableOrg key={org.id} org={org} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Action icon={<LogIn />} title="Sign in to an organization" detail="With the email you use there." onClick={() => crossTo('/login?intent=join')} />
        <Action icon={<Plus />} title="Create an organization" detail="A new board for a team." onClick={() => crossTo('/signup')} />
      </div>

    </AuthCard>
  )
}

const LIST = 'border-border divide-border m-0 list-none divide-y overflow-hidden rounded-xl border p-0 text-left'

/** One line of the list: something to click, as wide as the card. */
const ROW = 'group hover:bg-muted/60 flex items-center gap-3 px-3.5 py-3 transition-colors'

function OrgRow({ name, detail }: { name: string; detail: string }) {
  return (
    <>
      <OrgBadge name={name} />
      <OrgName name={name} detail={detail} />
      <ChevronRight className="text-muted-foreground size-4 flex-none transition-transform group-hover:translate-x-0.5" />
    </>
  )
}

function Action({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-primary flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-colors [&_svg]:size-4"
    >
      <span className="bg-primary/12 text-primary grid size-8 place-items-center rounded-lg">{icon}</span>
      <span className="font-semibold">{title}</span>
      <span className="text-muted-foreground text-[12.5px] leading-snug">{detail}</span>
    </button>
  )
}

function JoinableOrg({ org }: { org: OrgSummary }) {
  const join = useJoinOrg()
  const navigate = useNavigate()

  // Joining refreshes the list, which takes this row away. So the way into the organization
  // hangs on the request itself, not on this row still being on the page.
  const joinAndOpen = () =>
    join.mutateAsync(org.slug).then(
      () => navigate({ to: '/$org', params: { org: org.slug } }),
      () => {}, // The row shows the error.
    )

  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <OrgBadge name={org.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{org.name}</span>
        {join.isError && <span className="text-destructive block text-[12.5px]">{errorMessage(join.error)}</span>}
      </span>
      <Button variant="outline" className="h-8 rounded-lg px-3" disabled={join.isPending} onClick={joinAndOpen}>
        {join.isPending ? 'Joining…' : 'Join'}
      </Button>
    </li>
  )
}

function OrgName({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{name}</span>
      <span className="text-muted-foreground block truncate text-[12.5px]">{detail}</span>
    </span>
  )
}

/**
 * Where "/" sends you: straight into your organization when you have exactly one and nothing
 * else to choose, otherwise to the list.
 */
export function HomeRedirect() {
  const { orgs, joinable } = useMyOrgs()
  const signedIn = useSignedInOrgs()
  if (orgs.length === 1 && joinable.length === 0 && signedIn.length <= 1) return <Navigate to="/$org" params={{ org: orgs[0].slug }} replace />
  return <Navigate to="/organizations" replace />
}
