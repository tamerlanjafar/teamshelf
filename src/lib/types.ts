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
  name: string
  color: Color
  /** The place in the team's order, set by admins. null: after the placed ones, by name. */
  position: number | null
  created_at: string
}

/** What kind of thing a link is, for example "Frontend". Each organization has its own list. */
export interface Category {
  id: string
  org_id: string
  name: string
  color: Color
  position: number
}

/** One person managing one category: there they add, edit, delete and review links. */
export interface CategoryManager {
  category_id: string
  member_id: string
}

export type LinkStatus = 'pending' | 'approved' | 'rejected'

/** everyone: the whole organization. admins: admins and the super admin. members: only the chosen people. */
export type Visibility = 'everyone' | 'admins' | 'members'

export interface Link {
  id: string
  org_id: string
  group_id: string | null
  /** A suggestion for a group that doesn't exist yet. */
  proposed_group: string | null
  title: string
  url: string
  category_id: string | null
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
  /** Their own order of the links, for each group they rearranged. Other groups follow the team's order. */
  link_order: Record<string, string[]>
  hidden_groups: string[]
  hidden_links: string[]
}

export const NO_PREFS: BoardPrefs = { group_order: [], link_order: {}, hidden_groups: [], hidden_links: [] }
