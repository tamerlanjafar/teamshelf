import { Check, CheckCheck, Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { useGroups } from '@/api/groups'
import { useApproveLink, useApproveLinks, useDeleteLink, useRequests } from '@/api/links'
import { useMembers } from '@/api/members'
import { useSpaces } from '@/api/spaces'
import { PageSheet, SheetGroup } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { Button } from '@/components/ui/button'
import { useLinkDialog } from '@/features/links/link-dialog'
import { usePermissions } from '@/features/org/permissions'
import { toastError } from '@/lib/errors'
import type { Link } from '@/lib/types'
import { IconButton } from './icon-button'
import { RejectButton } from './reject-button'
import { RequestRow, StatusPill } from './request-row'

/**
 * Suggested links that are not on a board yet. Each space's admins approve or reject the ones
 * for their space here. Everyone follows their own.
 */
export function RequestsPage() {
  const { reviewer } = usePermissions()
  const lead = reviewer
    ? 'Links and files people suggested in the spaces you run, and your own suggestions elsewhere. Approved ones go on the space’s board.'
    : 'Links and files you suggested that are not on a board yet. An admin of the space reviews them.'

  return (
    <>
      <TopBar />
      <PageSheet title={reviewer ? 'Review suggestions' : 'Your suggestions'} lead={lead}>
        <Section compact skeleton={<ListSkeleton />}>
          <Requests />
        </Section>
      </PageSheet>
    </>
  )
}

function Requests() {
  const { reviewer, canManage } = usePermissions()
  const requests = useRequests()
  const groups = useGroups()
  const spaces = useSpaces()
  const members = useMembers()

  const waiting = requests.filter((link) => link.status === 'pending')
  const rejected = requests.filter((link) => link.status === 'rejected')

  const row = (link: Link, actions: ReactNode, status?: ReactNode) => (
    <RequestRow
      key={link.id}
      link={link}
      group={groups.find((group) => group.id === link.group_id)}
      space={spaces.find((space) => space.id === link.space_id)}
      author={members.find((member) => member.id === link.created_by)}
      status={status}
    >
      {actions}
    </RequestRow>
  )

  if (requests.length === 0) {
    return (
      <p className="bg-raised border-line text-quiet m-0 rounded-[14px] border px-4 py-8 text-center">
        {reviewer ? 'Nothing to review. New suggestions show up here.' : 'Nothing waiting. Use “Suggest link” to add something to the board.'}
      </p>
    )
  }

  return (
    <>
      {waiting.length > 0 && (
        <SheetGroup title="Waiting for review" count={waiting.length} action={<ApproveAll links={waiting.filter(canManage)} />}>
          {waiting.map((link) => row(link, canManage(link) ? <ReviewActions link={link} /> : <RemoveButton link={link} label="Withdraw" />))}
        </SheetGroup>
      )}
      {rejected.length > 0 && (
        <SheetGroup title="Rejected" count={rejected.length}>
          {rejected.map((link) => row(link, <RemoveButton link={link} label="Remove" />, <StatusPill tone="rejected">Rejected</StatusPill>))}
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
      <Button size="lg" className="ml-1.5" disabled={approveLink.isPending} onClick={() => approveLink.mutate(link, { onError: toastError })}>
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
    <Button variant="outline" size="lg" disabled={deleteLink.isPending} onClick={() => deleteLink.mutate(link.id, { onError: toastError })}>
      {label}
    </Button>
  )
}
