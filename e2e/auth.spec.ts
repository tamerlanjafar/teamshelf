import { expect, test } from '@playwright/test'
import { goto, openScreen, signedOut } from './helpers'

// Signing in by email link (/login), giving the email for a new organization (/signup), and what
// happens around them: a wrong address, the email sent, a link that expired.

test.describe('sign in', () => {
  test.beforeEach(async ({ page }) => signedOut(page))

  test('sent here by a page that needs signing in, shows the form, with the way back to it kept', async ({ page }) => {
    // Not goto(): the page leaves at once, so there is no page to wait for until the form's.
    await page.goto('/organizations')
    await page.waitForURL(/\/login\?redirect=%2Forganizations$/)
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('asks for an email and nothing else', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to Teamshelf' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel(/password/i)).toHaveCount(0)
  })

  test('refuses an address that is not an email, and says so under the field', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    // Typing again clears the message.
    await page.getByLabel('Email').fill('someone@example.com')
    await expect(page.getByText('Enter a valid email address.')).toHaveCount(0)
  })

  test('refuses an empty field', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  })

  test('Enter sends the link, like the button', async ({ page }) => {
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByLabel('Email').press('Enter')
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  })

  test('after sending: where it went, a countdown to resend, and a way back', async ({ page }) => {
    await page.getByLabel('Email').fill('  Someone@Example.com ')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    // The address as it will be used: trimmed, lower case.
    await expect(page.getByText('someone@example.com')).toBeVisible()
    await expect(page.getByText(/^0:\d\d$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resend email' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Use another email' }).click()
    await expect(page.getByLabel('Email')).toBeVisible()
  })

  test('the resend button appears when the countdown ends', async ({ page }) => {
    await page.clock.install()
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await page.clock.fastForward(61_000)
    await expect(page.getByRole('button', { name: 'Resend email' })).toBeVisible()
  })
})

test('after signing in, a way back that would lead to another site is ignored', async ({ page, context }) => {
  // "/\\evil.example" starts with one slash, but a browser reads it as "//evil.example".
  let leftTheSite = false
  await context.route('**://evil.example/**', (route) => {
    leftTheSite = true
    return route.fulfill({ body: 'another site' })
  })
  await signedOut(page)
  // Not through goto(): it hides mock mode's toolbar, which holds the emailed link.
  await page.goto(`/login?redirect=${encodeURIComponent('/\\evil.example')}`)
  await page.waitForFunction(() => !('$_TSR' in window))
  await page.getByLabel('Email').fill('sam.rivera@gmail.com')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await page.getByRole('button', { name: 'All screens' }).click()
  await page.getByRole('button', { name: /Open the sign-in link/ }).click()
  await page.waitForURL(/\/organizations$/)
  expect(leftTheSite).toBe(false)
})

test('a link that expired says so, without an error in the address', async ({ page }) => {
  await openScreen(page, 'link-expired')
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByText('That link has expired. Sign in again to get a new one.')).toBeVisible()
})

test.describe('between signing in and creating', () => {
  test('signing in links to creating an organization, and back', async ({ page }) => {
    await signedOut(page)
    await page.getByRole('link', { name: 'Create an organization' }).click()
    await expect(page).toHaveURL(/\/signup$/)
    await expect(page.getByRole('heading', { name: 'Create an organization' })).toBeVisible()
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Welcome to Teamshelf' })).toBeVisible()
  })
})

test.describe('the way back to your organizations', () => {
  test('is not offered on a browser with no organizations', async ({ page }) => {
    await signedOut(page)
    await goto(page, '/signup')
    await expect(page.getByRole('heading', { name: 'Create an organization' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Your organizations' })).toHaveCount(0)
  })

  test('is offered when signing in to another organization', async ({ page }) => {
    await openScreen(page, 'board')
    await goto(page, '/login?intent=join')
    await page.getByRole('button', { name: 'Your organizations' }).click()
    await page.waitForURL('**/organizations')
  })
})

test.describe('create an organization', () => {
  test('/signup asks for the email that will own it', async ({ page }) => {
    await signedOut(page)
    await goto(page, '/signup')
    await expect(page.getByRole('heading', { name: 'Create an organization' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  })

  test('the older address /login?intent=create goes to /signup', async ({ page }) => {
    await signedOut(page)
    await goto(page, '/login?intent=create')
    await expect(page).toHaveURL(/\/signup$/)
  })

  test('an email already signed in on this browser skips the link', async ({ page }) => {
    await openScreen(page, 'login-create')
    await page.getByLabel('Email').fill('alex@acme.com')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/new$/)
  })

  test('an email that may not create organizations is sent back, with the reason', async ({ page }) => {
    await openScreen(page, 'create-denied')
    await expect(page).toHaveURL(/\/signup$/)
    await expect(page.getByText(/Creating organizations is limited to approved emails/)).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('sam.rivera@gmail.com')
  })
})
