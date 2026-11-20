import { Link, useNavigate } from '@tanstack/react-router'
import { Check, ChevronsUpDown, LayoutGrid, Plus } from 'lucide-react'
import { useCanCreateOrg, useMyOrgsIfLoaded } from '@/api/orgs'
import { DropdownMenu, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useOrg } from '@/features/org/org-context'
import { BrandMark } from './brand'

/**
 * The brand and the name of the open organization. The mark goes to the board (on a phone there is only room for the name). The name opens
 * a menu to switch to another organization (one sign-in covers them all) or create one.
 */
export function OrgSwitcher() {
  const org = useOrg()
  const navigate = useNavigate()
  const orgs = useMyOrgsIfLoaded()
  const canCreate = useCanCreateOrg()

  return (
    <div className="flex h-11 min-w-0 items-center gap-1 max-sm:mr-auto">
      <Link to="/$org" params={{ org: org.slug }} search={{}} aria-label={`${org.name}, all links`} className="grid size-9 flex-none place-items-center rounded-lg max-sm:hidden">
        <BrandMark />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch organization"
          className="hover:bg-ink/6 data-[popup-open]:bg-ink/6 flex h-9 min-w-0 items-center gap-1.5 rounded-lg pr-1.5 pl-2 text-[17px] font-[650] tracking-[-0.01em] [font-family:var(--font-rounded)]"
        >
          <span className="max-w-[22vw] truncate sm:max-w-[200px]">{org.name}</span>
          <ChevronsUpDown className="text-quiet size-3.5 flex-none" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="min-w-60 rounded-xl">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-quiet text-[12px] font-medium">Your organizations</DropdownMenuLabel>
            {orgs.map((other) => (
              <DropdownMenuItem key={other.id} onClick={() => navigate({ to: '/$org', params: { org: other.slug }, search: {} })}>
                <span className="min-w-0 flex-1 truncate">{other.name}</span>
                {other.id === org.id && <Check className="text-brand!" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: '/organizations' })}>
            <LayoutGrid />
            All organizations
          </DropdownMenuItem>
          {canCreate && (
            <DropdownMenuItem onClick={() => navigate({ to: '/new' })}>
              <Plus />
              Create an organization
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
