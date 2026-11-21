import { useMembers } from '@/api/members'
import { PageSheet, SheetGroup } from '@/components/app/page-sheet'
import { ListSkeleton, Section } from '@/components/app/section'
import { TopBar } from '@/components/app/top-bar'
import { useOrg } from '@/features/org/org-context'
import { displayName } from '@/lib/roles'
import { InviteButton } from './invite-form'
import { MemberRow, WaitingRow } from './member-row'

/** Who is in the organization and what they may do. For its admins. */
export function TeamPage() {
  const org = useOrg()
  const domains = org.allowed_domains
  // The domains stand out from the sentence, joined as you'd say them: "a, b and c".
  const who = domains.length > 0 && (
    <>
      Anyone with an email at{' '}
      {domains.map((domain, index) => (
        <span key={domain}>
          {index > 0 && (index === domains.length - 1 ? ' or ' : ', ')}
          <span className="text-ink font-medium">@{domain}</span>
        </span>
      ))}{' '}
      can join on their own.
    </>
  )

  return (
    <>
      <TopBar />
      <PageSheet title="Team" lead={who || undefined} action={<InviteButton />}>
        <Section compact skeleton={<ListSkeleton rows={4} />}>
          <Members />
        </Section>
      </PageSheet>
    </>
  )
}

/**
 * Invitations waiting for approval first, as cards. Then everyone in one list: those who signed
 * in, and those invited who haven't yet, marked as such. Org Admins first, then by name.
 */
function Members() {
  const members = useMembers()
  const waiting = members.filter((member) => !member.approved)
  const people = members
    .filter((member) => member.approved)
    .sort((a, b) => (a.role === b.role ? displayName(a).localeCompare(displayName(b)) : a.role === 'admin' ? -1 : 1))

  return (
    <>
      {/* Invited from a space, from outside what the organization lets in: an admin decides. */}
      {waiting.length > 0 && (
        <SheetGroup cards title="Waiting for approval" count={waiting.length}>
          {waiting.map((member) => (
            <WaitingRow key={member.id} member={member} />
          ))}
        </SheetGroup>
      )}
      <SheetGroup title="People" count={people.length}>
        {people.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
      </SheetGroup>
    </>
  )
}
