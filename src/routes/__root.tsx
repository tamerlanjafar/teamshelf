import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/lib/theme'

export const Route = createRootRoute({ component: Root })

function Root() {
  const theme = useTheme()
  return (
    <TooltipProvider delay={400}>
      <Outlet />
      <Toaster theme={theme} position="bottom-center" toastOptions={{ style: { borderRadius: 12 } }} />
    </TooltipProvider>
  )
}
