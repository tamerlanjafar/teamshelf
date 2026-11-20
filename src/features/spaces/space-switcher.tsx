import { ChevronsUpDown, Lock, Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { useSpacesIfLoaded } from '@/api/spaces'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { usePermissions } from '@/features/org/permissions'
import { cn } from '@/lib/utils'
import { useCurrentSpaceIfLoaded, useOpenSpace } from './current-space'
import { NewSpaceDialog } from './new-space-dialog'
import { SpaceLogo } from './space-logo'

/**
 * The open space, and a menu to open another one. Its admins find the space's settings here,
 * and the organization's admins can start a new space.
 */
export function SpaceSwitcher() {
  const spaces = useSpacesIfLoaded()
  const space = useCurrentSpaceIfLoaded()
  const openSpace = useOpenSpace()
  const { admin, isSpaceAdmin } = usePermissions()
  const [creating, setCreating] = useState(false)

  if (!space) {
    if (!admin) return null
    return (
      <>
        <button type="button" onClick={() => setCreating(true)} className="hover:bg-ink/6 text-quiet flex h-10 min-w-0 items-center gap-2 rounded-xl px-2.5 text-[15px] font-medium">
          <Plus className="size-4" />
          New space
        </button>
        <NewSpaceDialog open={creating} onOpenChange={setCreating} />
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Space: ${space.name}. Switch space`}
          className="hover:bg-ink/6 data-[popup-open]:bg-ink/6 flex h-10 max-w-full min-w-0 items-center gap-2 rounded-xl pr-2 pl-1.5 text-[16px] font-[650] tracking-[-0.01em] [font-family:var(--font-rounded)]"
        >
          <SpaceLogo space={space} />
          <span className="min-w-0 truncate">{space.name}</span>
          <ChevronsUpDown className="text-quiet size-3.5 flex-none" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="max-h-[min(70dvh,520px)] w-[min(18rem,calc(100vw-2rem))] rounded-xl">
          <DropdownMenuGroup className="grid gap-1">
            <DropdownMenuLabel className="text-quiet text-[12px] font-medium">Spaces</DropdownMenuLabel>
            {spaces.map((other) => {
              const open = other.id === space.id
              return (
                <DropdownMenuItem
                  key={other.id}
                  aria-current={open ? 'true' : undefined}
                  onClick={() => openSpace(other)}
                  className={cn('gap-2.5', open && 'bg-[color-mix(in_srgb,var(--brand)_11%,transparent)] font-semibold focus:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]')}
                >
                  <SpaceLogo space={other} className="size-6 rounded-[7px]" />
                  <span className="min-w-0 flex-1 truncate">{other.name}</span>
                  {other.visibility === 'private' && <Lock className="text-quiet size-3.5" aria-label="Private" />}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
          {(isSpaceAdmin(space.id) || admin) && <DropdownMenuSeparator />}
          {isSpaceAdmin(space.id) && (
            <DropdownMenuItem onClick={() => openSpace(space, 'settings')}>
              <Settings2 />
              {space.name} settings
            </DropdownMenuItem>
          )}
          {admin && (
            <DropdownMenuItem onClick={() => setCreating(true)}>
              <Plus />
              New space…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {admin && <NewSpaceDialog open={creating} onOpenChange={setCreating} />}
    </>
  )
}
