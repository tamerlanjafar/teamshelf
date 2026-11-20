import { Link } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { useJoinOrg, useOrgAccess } from '@/api/orgs'
import { usePreloadOrg } from '@/api/preload'
import { ConfirmProvider } from '@/components/app/confirm-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { AUTH_BUTTON, AuthCard, Strong } from '@/features/auth/screens'
import { LinkDialogProvider } from '@/features/links/link-dialog'
import { errorMessage } from '@/lib/errors'
import { neon } from '@/lib/neon'
import { OrgProvider } from './org-context'

// The first time the app opens, the splash screen stays until everything on the page is loaded.
// After that, going somewhere else shows the page at once, with skeletons where data is missing.
let started = false

/** Whether the app has shown its first complete page. */
export const hasStarted = () => started

/**
 * Opens the organization at this address for the signed-in person. Its pages only render for
 * a member. Someone whose email's domain is allowed is offered to join, everyone else is told
 * there is nothing here for them. This is for a good experience only: the database decides
 * what each person can read and change.
 *
 * Suspends while it finds out, so it needs a boundary above it.
 */
export function OrgGate({ slug, children }: { slug: string; children: ReactNode }) {
  const access = useOrgAccess(slug)

  if (!access) return <NoAccess slug={slug} />
  if (access.can_join) return <JoinOrg slug={slug} name={access.org.name} />

  return (
    <OrgProvider value={{ org: access.org, me: access.member }}>
      <ConfirmProvider>
        <LinkDialogProvider>{started ? children : <FirstLoad>{children}</FirstLoad>}</LinkDialogProvider>
      </ConfirmProvider>
    </OrgProvider>
  )
}

/** Holds back the first page (behind the splash screen) until all its data is there. */
function FirstLoad({ children }: { children: ReactNode }) {
  usePreloadOrg()
  useEffect(() => {
    started = true
  }, [])
  return children
}

function JoinOrg({ slug, name }: { slug: string; name: string }) {
  const join = useJoinOrg()
  return (
    <AuthCard title={`Join ${name}?`} description={`Your email is at a domain that ${name} lets in, so you don't need an invitation.`}>
      <Button size="lg" className={AUTH_BUTTON} disabled={join.isPending} onClick={() => join.mutate(slug)}>
        {join.isPending ? 'Joining…' : `Join ${name}`}
      </Button>
      <Link to="/organizations" className={buttonVariants({ variant: 'outline', size: 'lg', className: AUTH_BUTTON })}>
        Your organizations
      </Link>
      {join.isError && <p className="text-destructive m-0 text-center text-sm">{errorMessage(join.error)}</p>}
    </AuthCard>
  )
}

function NoAccess({ slug }: { slug: string }) {
  const email = neon.auth.useSession().data?.user.email
  return (
    <AuthCard
      title="Nothing here for you"
      description={
        <>
          There is no organization at <Strong>/{slug}</Strong>, or <Strong>{email}</Strong> isn't in it.
          <br />
          Ask one of its admins to invite you.
        </>
      }
    >
      <Link to="/organizations" className={buttonVariants({ size: 'lg', className: AUTH_BUTTON })}>
        Your organizations
      </Link>
    </AuthCard>
  )
}
