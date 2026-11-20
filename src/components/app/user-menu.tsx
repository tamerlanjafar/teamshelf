import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ListRestart, LogOut, Settings, Users } from 'lucide-react'
import { useBoardPrefsIfLoaded, useSaveBoardPrefs } from '@/api/prefs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMe, useOrg } from '@/features/org/org-context'
import { FEATURES } from '@/lib/features'
import { neon } from '@/lib/neon'
import { displayName, isAdmin } from '@/lib/roles'
import { Avatar } from './avatar'

/** Signs out and forgets everything that was loaded for this person. */
export function useSignOut() {
  const queryClient = useQueryClient()
  return async () => {
    await neon.auth.signOut()
    queryClient.clear()
  }
}

/** Your avatar: who you are, the way to Settings, and signing out. */
export function UserMenu() {
  const me = useMe()
  const org = useOrg()
  const navigate = useNavigate()
  const signOut = useSignOut()
  // With personal ordering switched on: a way back from your own order of the groups.
  const savePrefs = useSaveBoardPrefs()
  const prefs = useBoardPrefsIfLoaded()
  const ownGroupOrder = FEATURES.personalOrder && prefs.group_order.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Your account" className="bg-surface border-line data-[popup-open]:border-brand grid size-10 flex-none place-items-center rounded-xl border transition-colors">
        <Avatar member={me} className="size-7 text-[11px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(16rem,calc(100vw-2rem))] rounded-xl">
        <div className="px-2 py-1.5">
          <div className="truncate font-medium">{displayName(me)}</div>
          <div className="text-quiet truncate text-[12.5px]">{me.email}</div>
        </div>
        <DropdownMenuSeparator />
        {/* On a phone the bar has no room for Team, so it is here. */}
        {isAdmin(me) && (
          <DropdownMenuItem className="sm:hidden" onClick={() => navigate({ to: '/$org/team', params: { org: org.slug } })}>
            <Users />
            Team
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate({ to: '/$org/settings', params: { org: org.slug } })}>
          <Settings />
          Settings
        </DropdownMenuItem>
        {ownGroupOrder && (
          <DropdownMenuItem onClick={() => savePrefs.mutate({ group_order: [] })}>
            <ListRestart />
            Use the team's order of groups
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
