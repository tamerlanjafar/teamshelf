import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, LayoutGrid, Plus } from 'lucide-react'
import { useCanCreateOrg, useMyOrgsIfLoaded } from '@/api/orgs'
import { DropdownMenu, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useOrg } from '@/features/org/org-context'
import { cn } from '@/lib/utils'
import { BrandMark } from './brand'

/**
 * The brand and the name of the open organization. The name opens a menu to switch to another
 * organization (one sign-in covers them all) or create one. On a phone there is only room for
 * the mark, so the mark opens that menu there.
 */
export function OrgSwitcher() {
  const org = useOrg()
  const navigate = useNavigate()
  const orgs = useMyOrgsIfLoaded()
  const canCreate = useCanCreateOrg()

  return (
    <div className="flex h-10 flex-none items-center gap-1">
      <Link to="/$org" params={{ org: org.slug }} aria-label={`${org.name}, links`} className="grid size-9 flex-none place-items-center rounded-lg max-md:hidden">
        <BrandMark />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${org.name}. Switch organization`}
          className="hover:bg-ink/6 data-[popup-open]:bg-ink/6 flex h-10 min-w-0 items-center gap-1.5 rounded-xl pr-1.5 pl-2 text-[16px] font-[650] tracking-[-0.01em] [font-family:var(--font-rounded)] max-md:size-10 max-md:justify-center max-md:p-0"
        >
          <BrandMark className="md:hidden" />
          <span className="max-w-[160px] truncate max-md:hidden lg:max-w-[200px]">{org.name}</span>
          <ChevronsUpDown className="text-quiet size-3.5 flex-none max-md:hidden" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className="min-w-60 rounded-xl">
          <DropdownMenuGroup className="grid gap-1">
            <DropdownMenuLabel className="text-quiet text-[12px] font-medium">Your organizations</DropdownMenuLabel>
            {orgs.map((other) => (
              <DropdownMenuItem
                key={other.id}
                aria-current={other.id === org.id ? 'true' : undefined}
                onClick={() => navigate({ to: '/$org', params: { org: other.slug } })}
                className={cn(other.id === org.id && 'bg-[color-mix(in_srgb,var(--brand)_11%,transparent)] font-semibold focus:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]')}
              >
                <span className="min-w-0 flex-1 truncate">{other.name}</span>
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
