import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { useJoinOrg, useMyOrgs } from '@/api/orgs'
import { Button } from '@/components/ui/button'
import { useSignOut } from '@/components/app/user-menu'
import { AuthCard } from '@/features/auth/screens'
import { errorMessage } from '@/lib/errors'
import { neon } from '@/lib/neon'
import type { OrgSummary } from '@/lib/types'

/**
 * The organizations you are in, the ones your email lets you join, and (for the accounts
 * allowed to) a way to create one, all in one list. Who you are signed in as, and signing
 * out, sit quietly below it.
 *
 * Suspends while the list loads, so it needs a boundary above it.
 */
export function OrgsPage() {
  const { orgs, joinable, can_create: canCreate } = useMyOrgs()
  const signOut = useSignOut()
  const email = neon.auth.useSession().data?.user.email
  const nothing = orgs.length === 0 && joinable.length === 0

  return (
    <AuthCard
      title={nothing ? 'Welcome to Teamshelf' : 'Choose an organization'}
      description={
        nothing ? (
          <>
            You aren't in an organization yet.
            <br />
            {canCreate ? 'Create one for your team, or ask an admin to invite you.' : 'Ask an admin of an organization to invite you.'}
          </>
        ) : undefined
      }
    >
      {(!nothing || canCreate) && (
        <ul className="border-border divide-border m-0 list-none divide-y overflow-hidden rounded-xl border p-0 text-left">
          {orgs.map((org) => (
            <li key={org.id}>
              <Link to="/$org" params={{ org: org.slug }} className={ROW}>
                <OrgBadge name={org.name} />
                <OrgName name={org.name} detail={`/${org.slug}`} />
                <ChevronRight className="text-muted-foreground size-4 flex-none transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
          {joinable.map((org) => (
            <JoinableOrg key={org.id} org={org} />
          ))}
          {canCreate && (
            <li>
              <Link to="/new" className={ROW}>
                <span aria-hidden="true" className="border-border text-muted-foreground group-hover:border-primary group-hover:text-primary grid size-9 flex-none place-items-center rounded-[10px] border border-dashed transition-colors">
                  <Plus className="size-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium">Create an organization</span>
              </Link>
            </li>
          )}
        </ul>
      )}

      <p className="text-muted-foreground m-0 mt-3 text-center text-sm">
        <span className="wrap-break-word">{email}</span>
        <span aria-hidden="true"> · </span>
        <button type="button" onClick={signOut} className="text-card-foreground font-medium hover:underline">
          Sign out
        </button>
      </p>
    </AuthCard>
  )
}

/** One line of the list: something to click, as wide as the card. */
const ROW = 'group hover:bg-muted/60 flex items-center gap-3 px-3.5 py-3 transition-colors'

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
      <OrgName name={org.name} detail={join.isError ? errorMessage(join.error) : 'Open to your email domain'} />
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

/** The first letter of an organization's name, in a rounded square. */
function OrgBadge({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="bg-primary/12 text-primary grid size-9 flex-none place-items-center rounded-[10px] text-[15px] font-bold [font-family:var(--font-rounded)]">
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}

/**
 * Where "/" sends you: straight into your organization when you have exactly one and nothing
 * else to choose, otherwise to the list.
 */
export function HomeRedirect() {
  const { orgs, joinable } = useMyOrgs()
  if (orgs.length === 1 && joinable.length === 0) return <Navigate to="/$org" params={{ org: orgs[0].slug }} replace />
  return <Navigate to="/organizations" replace />
}
