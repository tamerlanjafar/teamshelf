import { expect, test, type Page } from '@playwright/test'
import { goto, openScreen } from './helpers'

// Teams: named sets of people, made on the Team page, so a private space, a group or a link can
// be given to a whole team at once. Acme has Backend (Alex, Priya), On call (Sam, Mina) and Leads
// (Alex, Sam). On the "teams" screens, Leadership took in Backend, Development's Security group is
// shown only to On call, and Datadog only to Backend.

const teamsList = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: /^Teams/ }) })

test.describe('on the Team page', () => {
  test('lists the teams with who is in them', async ({ page }) => {
    await openScreen(page, 'team')
    const teams = teamsList(page)
    await expect(teams.getByRole('heading', { name: /Teams/ })).toContainText('3')
    await expect(teams.getByText('Backend', { exact: true })).toBeVisible()
    await expect(teams.getByText('Alex Morgan and Priya Nair')).toBeVisible()
  })

  test('without teams, says what they are for', async ({ page }) => {
    await openScreen(page, 'team-no-teams')
    await expect(page.getByText(/No teams yet\. Put people of Acme in a team/)).toBeVisible()
  })

  test('creating a team with the people picked', async ({ page }) => {
    await openScreen(page, 'team')
    await page.getByRole('button', { name: 'New team' }).click()
    const dialog = page.getByRole('dialog', { name: 'New team' })
    await expect(dialog.getByRole('button', { name: 'Create team' })).toBeDisabled()
    await dialog.getByLabel('Name', { exact: true }).fill('Design crew')
    await dialog.getByRole('checkbox', { name: /Mina Park/ }).click()
    await dialog.getByRole('checkbox', { name: /Priya Nair/ }).click()
    await expect(dialog.getByText('2 people picked')).toBeVisible()
    await dialog.getByRole('button', { name: 'Create team' }).click()
    await expect(page.getByText('Design crew was created.')).toBeVisible()
    await expect(teamsList(page).getByText('Mina Park and Priya Nair')).toBeVisible()
  })

  test('a team name already used is refused', async ({ page }) => {
    await openScreen(page, 'team')
    await page.getByRole('button', { name: 'New team' }).click()
    const dialog = page.getByRole('dialog', { name: 'New team' })
    await dialog.getByLabel('Name', { exact: true }).fill('backend')
    await dialog.getByRole('button', { name: 'Create team' }).click()
    await expect(dialog.getByText('There is already a team called backend.')).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('editing a team: renaming it and taking someone out', async ({ page }) => {
    await openScreen(page, 'team')
    await page.getByRole('button', { name: 'More for Backend' }).click()
    await page.getByRole('menuitem', { name: 'Edit…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit Backend' })
    await expect(dialog.getByRole('checkbox', { name: /Priya Nair/ })).toHaveAttribute('aria-checked', 'true')
    await dialog.getByLabel('Name', { exact: true }).fill('Platform')
    await dialog.getByRole('checkbox', { name: /Priya Nair/ }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toHaveCount(0)
    const teams = teamsList(page)
    await expect(teams.getByText('Platform', { exact: true })).toBeVisible()
    await expect(teams.getByText('Backend', { exact: true })).toHaveCount(0)
    await expect(teams.getByText('Alex Morgan', { exact: true })).toBeVisible()
  })

  test('deleting a team asks first, and says its people stay', async ({ page }) => {
    await openScreen(page, 'team')
    await page.getByRole('button', { name: 'More for On call' }).click()
    await page.getByRole('menuitem', { name: 'Delete…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete On call?' })
    await expect(dialog).toContainText('Its people stay in Acme.')
    await dialog.getByRole('button', { name: 'Delete team' }).click()
    await expect(teamsList(page).getByText('On call', { exact: true })).toHaveCount(0)
    await expect(page.locator('main').getByText('mina@acme.com')).toBeVisible()
  })

  test('the space count includes a private space someone is in through a team', async ({ page }) => {
    // Mina is in the three open spaces; Leadership takes in On call, her team.
    await openScreen(page, 'space-settings-teams')
    await page.getByRole('button', { name: 'Add teams' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add teams to Leadership' })
    await dialog.getByRole('checkbox', { name: /On call/ }).click()
    await dialog.getByRole('button', { name: 'Add team' }).click()
    await expect(dialog).toHaveCount(0)
    await goto(page, '/acme/team')
    await page.getByRole('button', { name: '4 spaces for Mina Park' }).click()
    await expect(page.getByRole('dialog', { name: "Mina Park's spaces" }).getByRole('listitem').filter({ hasText: 'Leadership' })).toContainText('Member')
  })
})

test.describe('people who manage teams', () => {
  test('an Org Admin lets someone manage teams, and stops it', async ({ page }) => {
    await openScreen(page, 'team')
    const mina = page.getByText('mina@acme.com').locator('xpath=ancestor::div[contains(@class,"px-4")][1]')
    await page.getByRole('button', { name: 'More for Mina Park' }).click()
    await page.getByRole('menuitem', { name: 'Let manage teams' }).click()
    await expect(mina).toContainText('Manages teams')
    await page.getByRole('button', { name: 'More for Mina Park' }).click()
    await page.getByRole('menuitem', { name: 'Stop managing teams' }).click()
    await expect(mina).not.toContainText('Manages teams')
  })

  test('see the people and every team, but change only the teams they created', async ({ page }) => {
    await openScreen(page, 'team-manager')
    await expect(page.locator('aside').getByRole('link', { name: 'Team' })).toBeVisible()
    await expect(page.locator('main').getByText('priya@acme.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Invite' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'More for Priya Nair' })).toHaveCount(0)
    await expect(page.getByText('Waiting for approval')).toHaveCount(0)

    const teams = teamsList(page)
    await expect(teams.getByText('Backend', { exact: true })).toBeVisible()
    await expect(teams.getByText('by Sam Lee').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'More for Backend' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'More for On call' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'More for Leads' })).toBeVisible()
  })

  test('a team they create is theirs to change', async ({ page }) => {
    await openScreen(page, 'team-manager')
    await page.getByRole('button', { name: 'New team' }).click()
    const dialog = page.getByRole('dialog', { name: 'New team' })
    await dialog.getByLabel('Name', { exact: true }).fill('Reviewers')
    await dialog.getByRole('checkbox', { name: /Priya Nair/ }).click()
    await dialog.getByRole('button', { name: 'Create team' }).click()
    await expect(page.getByText('Reviewers was created.')).toBeVisible()
    await page.getByRole('button', { name: 'More for Reviewers' }).click()
    await expect(page.getByRole('menuitem', { name: 'Edit…' })).toBeVisible()
  })

  test('a member who doesn’t manage teams has no Team page', async ({ page }) => {
    await openScreen(page, 'board-member')
    await expect(page.locator('aside').getByRole('link', { name: 'Team' })).toHaveCount(0)
    await goto(page, '/acme/team')
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toHaveCount(0)
  })
})

test.describe('a private space', () => {
  test('lists the teams it took in, with how many people each has', async ({ page }) => {
    await openScreen(page, 'space-settings-teams')
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Teams/ }) })
    await expect(panel.getByText('Everyone in these teams is a member of Leadership')).toBeVisible()
    await expect(panel.getByText('Backend', { exact: true })).toBeVisible()
    await expect(panel.getByText('2 people')).toBeVisible()
  })

  test('adding a team, and taking it out again', async ({ page }) => {
    await openScreen(page, 'space-settings-teams')
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Teams/ }) })
    await page.getByRole('button', { name: 'Add teams' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add teams to Leadership' })
    await expect(dialog.getByRole('checkbox', { name: /Backend/ })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Add team' })).toBeDisabled()
    await dialog.getByRole('checkbox', { name: /On call/ }).click()
    await dialog.getByRole('button', { name: 'Add team' }).click()
    await expect(page.getByText('Team added to Leadership.')).toBeVisible()
    await expect(panel.getByText('On call', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'More for On call' }).click()
    await page.getByRole('menuitem', { name: 'Remove from Leadership' }).click()
    await expect(panel.getByText('On call', { exact: true })).toHaveCount(0)
  })

  test('opening it to everyone says its teams are taken off too', async ({ page }) => {
    await openScreen(page, 'space-settings-teams')
    await page.getByRole('radio', { name: /Everyone in Acme/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Open Leadership to everyone in Acme?' })
    await expect(dialog).toContainText('Its 2 members and 1 team are taken off its list')
    await dialog.getByRole('button', { name: 'Open to everyone' }).click()
    await expect(page.getByRole('heading', { name: /^Teams/ })).toHaveCount(0)
  })

  test('an open space has no teams to add', async ({ page }) => {
    await openScreen(page, 'space-settings')
    await expect(page.getByRole('button', { name: 'Add teams' })).toHaveCount(0)
  })

  test('someone in a team it took in sees it', async ({ page }) => {
    await openScreen(page, 'board-teams-member')
    await page.locator('aside').getByRole('link', { name: 'Leadership', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Plans' })).toBeVisible()
  })
})

test.describe('groups and links shown to teams', () => {
  test('a member doesn’t see a group shown to a team they aren’t in, and sees a link shown to theirs', async ({ page }) => {
    await openScreen(page, 'board-teams-member')
    await expect(page.getByRole('region', { name: 'Monitoring' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Security' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '1Password' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Datadog' })).toBeVisible()
  })

  test('the space’s admins see every group, a restricted one marked', async ({ page }) => {
    await openScreen(page, 'board-teams')
    const security = page.getByRole('region', { name: 'Security' })
    await expect(security.getByLabel('Only some people see this group')).toBeVisible()
  })

  test('showing a group only to a team', async ({ page }) => {
    await openScreen(page, 'board')
    const tools = page.getByRole('region', { name: 'Tools' })
    await expect(tools.getByLabel('Only some people see this group')).toHaveCount(0)
    await tools.getByRole('button', { name: 'More for Tools' }).click()
    await page.getByRole('menuitem', { name: 'Edit…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit group' })
    await dialog.getByRole('radio', { name: 'People & teams' }).click()
    await expect(dialog.getByText('Only those you add, and admins of Development, see this group.')).toBeVisible()
    await dialog.getByRole('combobox', { name: 'Add teams or people' }).fill('lea')
    await page.getByRole('option', { name: /Leads/ }).click()
    await expect(dialog.getByText('Leads', { exact: true })).toBeVisible()
    await page.getByText('Edit group', { exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(tools.getByLabel('Only some people see this group')).toBeVisible()
  })

  test('a group shown to chosen people needs at least one', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('region', { name: 'Tools' }).getByRole('button', { name: 'More for Tools' }).click()
    await page.getByRole('menuitem', { name: 'Edit…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit group' })
    await dialog.getByRole('radio', { name: 'People & teams' }).click()
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog.getByText('Choose at least one team or person.')).toBeVisible()
  })

  test('editing a restricted group keeps the teams it was shown to', async ({ page }) => {
    await openScreen(page, 'board-teams')
    await page.getByRole('region', { name: 'Security' }).getByRole('button', { name: 'More for Security' }).click()
    await page.getByRole('menuitem', { name: 'Edit…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit group' })
    await expect(dialog.getByRole('radio', { name: 'People & teams' })).toHaveAttribute('aria-checked', 'true')
    await expect(dialog.getByText('On call', { exact: true })).toBeVisible()
  })

  test('showing a link only to a team', async ({ page }) => {
    await openScreen(page, 'board')
    await page.getByRole('button', { name: 'More for Grafana' }).click()
    await page.getByRole('menuitem', { name: 'Edit…' }).click()
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('radiogroup', { name: 'Who can see it' }) })
    await dialog.getByRole('radio', { name: 'People & teams' }).click()
    await dialog.getByRole('combobox', { name: 'Add teams or people' }).click()
    await page.getByRole('option', { name: /On call/ }).click()
    // The list stays open for more; clicking elsewhere in the dialog closes it.
    await page.getByText('Edit link', { exact: true }).click()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: /Save/ }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Monitoring' }).getByLabel('Only some people see this')).toBeVisible()
  })
})
