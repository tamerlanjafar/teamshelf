// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nameError, nameFromFile } from './name-rules.ts'

const BOARD: Record<string, string[]> = {
  Jenkins: ['Checkout (Nightly)', 'Billing'],
  Apps: ['Customer Portal (Beta)', 'Admin Console'],
  Swagger: ['Payments Service'],
  Docs: ['Confluence', 'Onboarding Guide'],
}
const check = (name: string, groupName: string) => nameError(name, { groupName, siblings: BOARD[groupName] ?? [] })

const good: [string, string][] = [
  ['Checkout (Weekly)', 'Jenkins'],
  ['Customer Portal (v2)', 'Apps'],
  ['Release Notes', 'Docs'],
  ['iOS App (TestFlight)', 'Apps'],
  ['Self-service Terminal', 'Apps'],
  ['Load Test Report', 'Docs'],
  ['Payments API (v2)', 'Swagger'],
  ['R&D Handbook', 'Docs'],
  ['C# Style Guide', 'Docs'],
  ['Jenkinsfile Docs', 'Jenkins'],
]
for (const [name, group] of good) test(`${JSON.stringify(name)} passes`, () => assert.equal(check(name, group), null))

const bad: [name: string, group: string, startOfMessage: string][] = [
  ['', 'Docs', 'Give the link a name'],
  ['x', 'Docs', 'A name needs at least 2'],
  ['https://jenkins.example.com/job/checkout', 'Jenkins', 'This is an address'],
  ['grafana.example.com', 'Docs', 'This is an address'],
  ['Jenkins Checkout', 'Jenkins', 'Drop “Jenkins” from the front. The card already shows the group, so write “Checkout”'],
  ['jenkins: Checkout', 'Jenkins', 'Drop “Jenkins”'],
  ['Customer Portal - Beta', 'Apps', 'Remove “-”. Put extra detail in brackets: “Customer Portal (Beta)”'],
  ['Customer Portal – Beta', 'Apps', 'Remove “–”. Put extra detail in brackets: “Customer Portal (Beta)”'],
  ['Customer Portal | Beta', 'Apps', 'Remove “|”'],
  ['Payments_API', 'Swagger', 'Remove “_”'],
  ['🚀 Deploy Dashboard', 'Jenkins', 'Remove “🚀”'],
  ['Customer  Portal', 'Apps', 'Use one space'],
  ['Release Notes.', 'Docs', 'Remove the “.” at the end'],
  ['Payments API (v2', 'Swagger', 'Close the bracket'],
  ['Link', 'Docs', '“Link” doesn\'t say'],
  ['onboarding checklist', 'Docs', 'Start with a capital letter: “Onboarding checklist”'],
  ['CONFLUENCE Space', 'Docs', 'Write “CONFLUENCE” as “Confluence”'],
  ['Onboarding Guide', 'Docs', 'Docs already has “Onboarding Guide”'],
  ['Customer portal (v3)', 'Apps', 'Write “Customer portal” as “Customer Portal”'],
]
for (const [name, group, message] of bad) {
  test(`${JSON.stringify(name)} is refused`, () => assert.ok(check(name, group)?.startsWith(message), `got ${check(name, group)}`))
}

test('file names become a name to start from', () => {
  assert.equal(nameFromFile('brand_guidelines-v2.final.pdf'), 'Brand guidelines v2 final')
  assert.equal(nameFromFile('Q3 Report.xlsx'), 'Q3 Report')
  assert.equal(check(nameFromFile('brand_guidelines-v2.final.pdf'), 'Docs'), null)
})
