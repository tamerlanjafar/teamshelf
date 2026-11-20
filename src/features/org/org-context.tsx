import { createContext, useContext } from 'react'
import type { Member, Org } from '@/lib/types'

interface OrgContextValue {
  org: Org
  me: Member
}

const OrgContext = createContext<OrgContextValue | null>(null)

export const OrgProvider = OrgContext.Provider

function useOrgContext() {
  const value = useContext(OrgContext)
  if (!value) throw new Error('This needs to be inside an organization page.')
  return value
}

/** The organization whose pages are open. */
export const useOrg = (): Org => useOrgContext().org

/** The signed-in person's membership in the open organization. */
export const useMe = (): Member => useOrgContext().me
