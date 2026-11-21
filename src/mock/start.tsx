// Mock mode (`pnpm dev:mock`): the real app, with a made-up backend in the browser. Started from
// main.tsx only in that mode, so none of this is in a production build.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Splash } from '@/features/auth/screens'
import { applyScenario } from './fixtures'
import { installMockFetch } from './fetch'
import { ALL_SCREENS, findScreen } from './screens'
import { getState, hasState, update } from './store'
import { Toolbar } from './toolbar'

/**
 * Sets the mock backend up. Returns true when this page only opens a screen (/__screens/go/<id>
 * sets its situation up, then loads its page), and the app should not be drawn.
 */
export function startMock(): boolean {
  installMockFetch()
  if (!hasState()) applyScenario('northwind')

  const { pathname } = window.location
  const go = pathname.match(/^\/__screens\/go\/([^/]+)/)
  if (go) {
    const screen = findScreen(go[1])
    if (screen) {
      applyScenario(screen.scenario, screen.role, screen.id)
      window.location.replace(screen.path)
    } else window.location.replace(`/__screens/go/${ALL_SCREENS[0].id}`)
    return true
  }
  // /__screens alone: the screen opened last, or the first one.
  if (pathname.startsWith('/__screens')) {
    window.location.replace(`/__screens/go/${findScreen(getState().screen ?? '')?.id ?? ALL_SCREENS[0].id}`)
    return true
  }

  // The steps of the screen just opened, once its page is there, behind the app's splash screen
  // so they don't show: it lifts when the page is in the state the screen is about.
  const acting = findScreen(getState().act ?? '')
  if (getState().act) update((draft) => void (draft.act = null))
  if (acting?.act) {
    const cover = document.createElement('div')
    cover.className = 'bg-page fixed inset-0 z-[999]'
    document.body.append(cover)
    const root = createRoot(cover)
    root.render(<Splash />)
    acting
      .act()
      .catch((problem: unknown) => console.warn(problem))
      .finally(() => {
        root.unmount()
        cover.remove()
      })
  }

  const holder = document.createElement('div')
  holder.id = 'mock-toolbar'
  document.body.append(holder)
  createRoot(holder).render(
    <StrictMode>
      <Toolbar />
    </StrictMode>,
  )
  return false
}
