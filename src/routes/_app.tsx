import { QueryClientProvider } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { useTheme } from '@/lib/theme'

/**
 * Every page except the front page: signing in, the organizations, and the app itself. It holds
 * what those pages share (data, tooltips, toasts), so the front page loads none of it. It adds
 * nothing to the address.
 */
export const Route = createFileRoute('/_app')({ component: AppLayout })

function AppLayout() {
  const theme = useTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={400}>
        <Outlet />
        <Toaster theme={theme} position="bottom-center" toastOptions={{ style: { borderRadius: 12 } }} />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
