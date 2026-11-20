// Rows as the Data API returns them. The tables are defined in db/migrations.

export type Role = 'super_admin' | 'admin' | 'member'

export interface Org {
  id: string
  /** The address: /<slug>/ */
  slug: string
  name: string
  /** People with an email at one of these domains can join without an invitation. */
  allowed_domains: string[]
}

/** An organization as listed on the "your organizations" page. `role` is missing for one you could join. */
export interface OrgSummary {
  id: string
  slug: string
  name: string
  role?: Role
}

export interface Member {
  id: string
  org_id: string
  email: string
  name: string
  role: Role
  /** Set the first time the person signs in. Until then they are only invited. */
  user_id: string | null
  invited_at: string
  joined_at: string | null
}

export type Color = 'blue' | 'indigo' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'graphite'

export interface Group {
  id: string
  org_id: string
  space_id: string
  name: string
  color: Color
  /** The place in the team's order, set by admins. null: after the placed ones, by name. */
  position: number | null
  created_at: string
}

/** everyone in the organization sees an "org" space. Only its members see a "private" one. */
export type SpaceVisibility = 'org' | 'private'

/** One team's part of the organization ("Development", "Design"), with its own groups, links and admins. */
export interface Space {
  id: string
  org_id: string
  /** In the address: ?space=<slug> */
  slug: string
  name: string
  /** One of the app's logos (see lib/space-logos.tsx), or an image as a data: address. */
  logo: string
  color: Color
  visibility: SpaceVisibility
  /** What may follow " - " in a link's name, in the order the board shows them. */
  environments: string[]
  /** The board's columns, each a list of group ids from top to bottom, as its admins arranged them. */
  layout: string[][]
  position: number | null
  created_at: string
}

export type SpaceRole = 'admin' | 'member'

/** One person in one space. Admins do everything inside it. */
export interface SpaceMember {
  space_id: string
  member_id: string
  role: SpaceRole
}

export type LinkStatus = 'pending' | 'approved' | 'rejected'

/** everyone: everyone who sees the space. admins: the space's admins. members: only the chosen people. */
export type Visibility = 'everyone' | 'admins' | 'members'

/** A web address, or a file kept by Teamshelf. */
export type LinkKind = 'link' | 'file'

export interface Link {
  id: string
  org_id: string
  space_id: string
  kind: LinkKind
  group_id: string | null
  /** A suggestion for a group that doesn't exist yet. */
  proposed_group: string | null
  title: string
  url: string
  /** The address of the site's icon, found when the link was saved. */
  icon_url: string | null
  /** For a file: where it is kept, its name, size in bytes and type. */
  file_key: string | null
  file_name: string | null
  file_size: number | null
  file_type: string | null
  status: LinkStatus
  visibility: Visibility
  /** The place in the team's order within its group. null: after the placed ones, by name. */
  position: number | null
  created_by: string | null
  created_at: string
  reviewed_at: string | null
  review_note: string
}

/** One person's own arrangement of the board. It never affects anyone else. */
export interface BoardPrefs {
  /** Their own order of the groups. Empty: they follow the team's order. */
  group_order: string[]
  /** Their own columns, per space (with personal ordering switched on). A space not listed follows the space's layout. */
  group_layout: Record<string, string[][]>
  /** Their own order of the links, for each group they rearranged. Other groups follow the team's order. */
  link_order: Record<string, string[]>
  hidden_groups: string[]
  hidden_links: string[]
  /** The links they opened lately, per space, newest first. Shown in the search box's launcher. */
  recent_links: Record<string, string[]>
}

export const NO_PREFS: BoardPrefs = { group_order: [], group_layout: {}, link_order: {}, hidden_groups: [], hidden_links: [], recent_links: {} }
