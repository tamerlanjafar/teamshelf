// Every screen of the app, each with the situation it needs. The toolbar lists them, and
// /__screens/go/<id> sets one up and opens it, so each has an address of its own.

import type { Role } from '@/lib/types'

/** Waits until `check` finds something on the page, as a person would wait for it to show. */
async function until<T>(check: () => T | null | undefined | false, what: string, timeout = 6000): Promise<T> {
  const start = Date.now()
  for (;;) {
    const found = check()
    if (found) return found
    if (Date.now() - start > timeout) throw new Error(`Mock mode: ${what} never showed.`)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
}

const element = <T extends Element>(selector: string) => until(() => document.querySelector<T>(selector), selector)

/** Waits for a heading with this text. */
const heading = (text: string) => until(() => [...document.querySelectorAll('h1, h2, h3, [data-slot="card-title"]')].find((one) => one.textContent?.trim() === text), text)

/** Types an email into the sign-in form and sends it, the way React sees typing. */
async function sendSignIn(email: string) {
  const input = await element<HTMLInputElement>('input#email')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, email)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  // Let React take the value in before sending.
  await new Promise((resolve) => setTimeout(resolve, 0))
  input.form?.requestSubmit()
  await heading('Check your email')
}

export interface Screen {
  id: string
  title: string
  /** What to look at, or what to do to get there, when the address alone isn't enough. */
  note?: string
  scenario: string
  role?: Role
  path: string
  /** Where the page ends up, when the app changes the address on arrival. The path otherwise. */
  shownAt?: string
  /** What a person would do on the page to reach this screen, done for you once it has loaded. */
  act?: () => Promise<void>
}

export interface ScreenGroup {
  title: string
  screens: Screen[]
}

export const SCREENS: ScreenGroup[] = [
  {
    title: 'Signing in',
    screens: [
      { id: 'login', title: 'Sign in', scenario: 'signed-out', path: '/login' },
      { id: 'check-email', title: 'Check your email', note: 'The toolbar opens the link.', scenario: 'signed-out', path: '/login', act: () => sendSignIn('sam.rivera@gmail.com') },
      // Opened the way Neon Auth sends someone whose link no longer works. The app takes the error out of the address.
      { id: 'link-expired', title: 'Link expired', scenario: 'signed-out', path: '/login?error=INVALID_TOKEN', shownAt: '/login' },
      { id: 'login-create', title: 'Create: which email', scenario: 'acme', path: '/login?intent=create' },
    ],
  },
  {
    title: 'Organizations',
    screens: [
      { id: 'welcome', title: 'No organization yet', scenario: 'newcomer', path: '/organizations' },
      { id: 'orgs', title: 'Your organizations', note: 'Two emails, and Orbit to join.', scenario: 'several', path: '/organizations' },
      { id: 'orgs-joinable', title: 'One organization and one to join', scenario: 'lumen', path: '/organizations' },
      { id: 'join-domain', title: 'Join by email domain', scenario: 'join-domain', path: '/orbit' },
      { id: 'no-access', title: "Can't open this organization", scenario: 'no-access', path: '/orbit' },
    ],
  },
  {
    title: 'Creating an organization',
    screens: [
      { id: 'create', title: 'Name and address', scenario: 'acme', path: '/new' },
      { id: 'create-denied', title: "Create: email can't create", scenario: 'newcomer', path: '/new', shownAt: '/login?intent=create' },
      { id: 'empty-org', title: 'Organization without spaces', scenario: 'empty-org', path: '/acme', shownAt: '/acme/none' },
      { id: 'empty-space', title: 'Space without groups', scenario: 'empty-space', path: '/acme/development' },
    ],
  },
  {
    title: 'Board',
    screens: [
      { id: 'board', title: 'Board, as an organization admin', scenario: 'acme', role: 'admin', path: '/acme/development' },
      { id: 'board-space-admin', title: 'Board, as an admin of this space', scenario: 'space-admin', path: '/acme/development' },
      { id: 'board-member', title: 'Board, as a member', note: 'No private spaces, Suggest instead of Add.', scenario: 'acme', role: 'member', path: '/acme/development' },
      { id: 'private-space', title: 'Private space', scenario: 'acme', path: '/acme/leadership' },
      { id: 'switcher', title: 'Organization menu, two emails', scenario: 'several', path: '/acme/development', act: async () => {
          ;(await element<HTMLButtonElement>('[aria-label$="Switch organization"]')).click()
          await element('[role="menu"]')
        },
      },
      { id: 'second-org', title: "The other email's organization", scenario: 'several', path: '/lumen/research' },
    ],
  },
  {
    title: 'Organization pages',
    screens: [
      { id: 'requests', title: 'Suggestions, as a reviewer', scenario: 'acme', path: '/acme/requests' },
      { id: 'requests-member', title: 'Suggestions, as a member', scenario: 'acme', role: 'member', path: '/acme/requests' },
      { id: 'team', title: 'Team', note: 'With an invitation waiting for approval.', scenario: 'acme', path: '/acme/team' },
      { id: 'org-settings', title: 'Organization settings', scenario: 'acme', path: '/acme/settings' },
      { id: 'space-settings', title: 'Space settings, as Org Admin', scenario: 'acme', path: '/acme/development/settings' },
      { id: 'space-settings-private-member', title: 'Private space settings, as Space Admin', note: 'Not an Org Admin, so they can\'t open it to everyone.', scenario: 'space-admin', path: '/acme/leadership/settings' },
      { id: 'space-settings-open-member', title: 'Open space settings, as Space Admin', note: 'Not an Org Admin, so making it private is one-way.', scenario: 'space-admin', path: '/acme/development/settings' },
    ],
  },
]

export const findScreen = (id: string) => SCREENS.flatMap((group) => group.screens).find((screen) => screen.id === id)

/** Every screen, in the toolbar's order. */
export const ALL_SCREENS = SCREENS.flatMap((group) => group.screens.map((screen) => ({ ...screen, group: group.title })))

/** Opens a screen: its situation is set up, then the page loads. */
export const openScreen = (id: string) => window.location.assign(`/__screens/go/${id}`)
