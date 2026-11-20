import { useMembers } from '@/api/members'
import { PageSheet, SheetGroup } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { useOrg } from '@/features/org/org-context'
import { InviteForm } from './invite-form'
import { MemberRow } from './member-row'

/** Who is in the organization and what they may do. For admins and the super admin. */
export function TeamPage() {
  const org = useOrg()
  const domains = org.allowed_domains.map((domain) => `@${domain}`).join(', ')
  const whoJoins = domains ? `Anyone with an email at ${domains} can join on their own. Invite anyone else here.` : 'People join by invitation.'

  return (
    <>
      <TopBar />
      <PageSheet
        title="Team"
        lead={`${whoJoins} Members see links and suggest new ones. Admins also manage this page. Someone who manages a category adds, edits and reviews the links in it.`}
      >
        <InviteForm />
        <Section compact skeleton={<ListSkeleton rows={4} />}>
          <Members />
        </Section>
      </PageSheet>
    </>
  )
}

function Members() {
  const members = useMembers()
  const joined = members.filter((member) => member.user_id)
  const invited = members.filter((member) => !member.user_id)

  return (
    <>
      {invited.length > 0 && (
        <SheetGroup title="Invited, not signed in yet" count={invited.length}>
          {invited.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </SheetGroup>
      )}
      <SheetGroup title="Members" count={joined.length}>
        {joined.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
      </SheetGroup>
    </>
  )
}
