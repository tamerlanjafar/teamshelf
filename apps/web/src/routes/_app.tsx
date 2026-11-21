import { QueryClientProvider } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'

/**
 * Every page except the front page: signing in, the organizations, and the app itself. It holds
 * what those pages share (data, tooltips, toasts), so the front page loads none of it. It adds
 * nothing to the address.
 */
export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={400}>
        <Outlet />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
