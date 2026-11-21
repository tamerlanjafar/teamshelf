import { Check, CheckCheck, Pencil, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from '@/components/ui/toast'
import { useGroups } from '@/api/groups'
import { useApproveLink, useApproveLinks, useDeleteLink, useRequests } from '@/api/links'
import { useMembers } from '@/api/members'
import { useSpaces } from '@/api/spaces'
import { PageSheet, SheetGroup } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { useLinkDialog } from '@/features/links/link-dialog'
import { useMe } from '@/features/org/org-context'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'
import { IconButton } from './icon-button'
import { RejectButton } from './reject-button'
import { RequestRow } from './request-row'

/**
 * Suggested links that are not on a board yet, on one page: first what waits for this person to
 * review (in the spaces they run), then what they sent themselves, waiting or turned down. Each
 * part only shows when it has something, so a member sees just their own.
 */
export function RequestsPage() {
  return (
    <>
      <TopBar />
      <PageSheet title="Suggestions">
        <Section compact skeleton={<ListSkeleton />}>
          <Requests />
        </Section>
      </PageSheet>
    </>
  )
}

function Requests() {
  const { canManage } = usePermissions()
  const me = useMe()
  const { addLink } = useLinkDialog()
  const requests = useRequests()
  const groups = useGroups()
  const spaces = useSpaces()
  const members = useMembers()

  const toReview = requests.filter((link) => link.status === 'pending' && canManage(link))
  const mine = requests.filter((link) => link.created_by === me.id && !toReview.includes(link))

  const row = (link: Link, actions: ReactNode) => (
    <RequestRow
      key={link.id}
      link={link}
      group={groups.find((group) => group.id === link.group_id)}
      space={spaces.find((space) => space.id === link.space_id)}
      author={members.find((member) => member.id === link.created_by)}
    >
      {actions}
    </RequestRow>
  )

  if (toReview.length === 0 && mine.length === 0)
    return (
      <div className="bg-raised border-line flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
        <p className="text-quiet m-0">No suggestions right now.</p>
        <Button variant="outline" onClick={() => addLink()}>
          <Plus />
          Suggest a link
        </Button>
      </div>
    )

  return (
    <>
      {toReview.length > 0 && (
        <SheetGroup cards title="Waiting for you" count={toReview.length} action={<ApproveAll links={toReview} />}>
          {toReview.map((link) => row(link, <ReviewActions link={link} />))}
        </SheetGroup>
      )}
      {mine.length > 0 && (
        <SheetGroup cards title="Sent by you" count={mine.length}>
          {mine.map((link) =>
            link.status === 'rejected'
              ? row(link, <RemoveButton link={link} label="Remove" />)
              : row(link, <RemoveButton link={link} label="Withdraw" />),
          )}
        </SheetGroup>
      )}
    </>
  )
}

/** Reject and edit are quiet icons, approve is the one button: it is what happens to most suggestions. */
function ReviewActions({ link }: { link: Link }) {
  const { editLink } = useLinkDialog()
  const approveLink = useApproveLink()
  return (
    <>
      <RejectButton link={link} />
      <IconButton label="Edit before approving" onClick={() => editLink(link)}>
        <Pencil />
      </IconButton>
      <Button className="ml-1" disabled={approveLink.isPending} onClick={() => approveLink.mutate(link, { onError: toastError })}>
        <Check />
        Approve
      </Button>
    </>
  )
}

/** Approves everything this person may review, when there is more than one. */
function ApproveAll({ links }: { links: Link[] }) {
  const approveLinks = useApproveLinks()
  if (links.length < 2) return null
  return (
    <Button
      variant="outline"
      disabled={approveLinks.isPending}
      onClick={() => approveLinks.mutate(links, { onSuccess: () => toast.success(`${links.length} links approved.`), onError: toastError })}
    >
      <CheckCheck />
      {approveLinks.isPending ? 'Approving…' : `Approve all ${links.length}`}
    </Button>
  )
}

function RemoveButton({ link, label }: { link: Link; label: string }) {
  const deleteLink = useDeleteLink()
  return (
    <Button variant="outline" size="sm" disabled={deleteLink.isPending} onClick={() => deleteLink.mutate(link.id, { onError: toastError })}>
      {label}
    </Button>
  )
}
