import { createFileRoute } from '@tanstack/react-router'
import { SignInScreen } from '@/features/auth/sign-in-screen'
import { pageHead } from '@/lib/site'

/** Creating an organization starts here: the email that will own it. Then /new, for its name. */
export const Route = createFileRoute('/_app/signup')({
  head: () =>
    pageHead({
      path: '/signup',
      title: 'Create an organization · Teamshelf',
      description: "Create your team's Teamshelf in a minute: a space for each team, with its links, docs and files in one place. Sign in by email, no passwords.",
    }),
  component: Signup,
})

function Signup() {
  return <SignInScreen intent="create" />
}
