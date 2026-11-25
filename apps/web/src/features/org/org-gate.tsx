import { Link } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { useJoinOrg, useOrgAccess } from '@/api/orgs'
import { usePreloadOrg } from '@/api/preload'
import { ConfirmProvider } from '@/components/app/confirm-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { AUTH_BUTTON, AUTH_SECONDARY, AuthCard, Strong } from '@/features/auth/screens'
import { FileViewerProvider } from '@/features/files/file-viewer'
import { FolderActionsProvider } from '@/features/folders/folder-dialogs'
import { LinkDialogProvider } from '@/features/links/link-dialog'
import { crossTo } from '@/lib/accounts'
import { errorMessage } from '@/lib/errors'
import { useSession } from '@/lib/neon'
import { OrgProvider } from './org-context'

// The first time the app opens, the splash screen stays until everything on the page is loaded.
// Opening another organization later does the same behind a page-shaped skeleton. After that,
// going somewhere else in the organization shows the page at once, with skeletons where data is missing.
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
        <FileViewerProvider>
          <LinkDialogProvider>
            <FolderActionsProvider>
              <Loaded>{children}</Loaded>
            </FolderActionsProvider>
          </LinkDialogProvider>
        </FileViewerProvider>
      </ConfirmProvider>
    </OrgProvider>
  )
}

/**
 * Holds back an organization's first page until all its data is there: behind the splash screen
 * when the app opens, behind the page's skeleton when switching to another organization. One
 * wait, then the whole page, instead of a frame first and its board after.
 */
function Loaded({ children }: { children: ReactNode }) {
  usePreloadOrg()
  useEffect(() => {
    started = true
  }, [])
  return children
}

/** An organization's address, opened with an email whose domain it lets in: joining takes one click. */
function JoinOrg({ slug, name }: { slug: string; name: string }) {
  const join = useJoinOrg()
  const domain = useSession().data?.user.email.split('@')[1]
  return (
    <AuthCard
      title={`Join ${name}?`}
      description={
        <>
          {name} lets anyone with an <Strong>@{domain}</Strong> email join, so you don't need an invitation.
        </>
      }
    >
      <Button size="lg" className={AUTH_BUTTON} disabled={join.isPending} onClick={() => join.mutate(slug)}>
        {join.isPending ? 'Joining…' : `Join ${name}`}
      </Button>
      <Link to="/organizations" className={buttonVariants({ variant: 'outline', size: 'lg', className: AUTH_SECONDARY })}>
        Back to your organizations
      </Link>
      {join.isError && <p className="text-destructive m-0 text-sm">{errorMessage(join.error)}</p>}
    </AuthCard>
  )
}

/**
 * An organization's address opened with an email that isn't in it, usually from a link someone
 * sent. It doesn't say whether the organization exists. The likely way in is the email the
 * person joined with, so that comes first.
 */
function NoAccess({ slug }: { slug: string }) {
  const email = useSession().data?.user.email
  return (
    <AuthCard
      title="Can't open this organization"
      description={
        <>
          <Strong>/{slug}</Strong> doesn't exist, or <Strong>{email}</Strong> isn't a member. If you joined with another email, sign in with that one.
        </>
      }
    >
      <Button size="lg" className={AUTH_BUTTON} onClick={() => crossTo(`/login?intent=join&redirect=${encodeURIComponent(`/${slug}`)}`)}>
        Sign in with another email
      </Button>
      <Link to="/organizations" className={buttonVariants({ variant: 'outline', size: 'lg', className: AUTH_SECONDARY })}>
        Back to your organizations
      </Link>
    </AuthCard>
  )
}
