// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nameError, nameFromFile } from './name-rules.ts'

const ENVS = ['Staging', 'Prod']
const BOARD: Record<string, string[]> = {
  Jenkins: ['Online - Prod', 'Retail - Staging'],
  Applications: ['Online WEB - Prod', 'BO Retail - Staging'],
  Swagger: ['Online Account Service'],
  Docs: ['Confluence', 'Onboarding Guide'],
}
const check = (name: string, groupName: string, environments = ENVS) => nameError(name, { groupName, siblings: BOARD[groupName] ?? [], environments })

const good: [string, string][] = [
  ['Online - Staging', 'Jenkins'],
  ['Online WEB - Staging', 'Applications'],
  ['Release Notes', 'Docs'],
  ['iOS App - Prod', 'Applications'],
  ['Self-service Terminal - Prod', 'Applications'],
  ['Load Test Report', 'Docs'],
  ['Payments API (v2) - Staging', 'Swagger'],
  ['R&D Handbook', 'Docs'],
  ['C# Style Guide', 'Docs'],
  ['Live Chat Widget - Prod', 'Applications'],
  ['Jenkinsfile Docs', 'Jenkins'],
]
for (const [name, group] of good) test(`${JSON.stringify(name)} passes`, () => assert.equal(check(name, group), null))

const bad: [name: string, group: string, startOfMessage: string][] = [
  ['', 'Docs', 'Give the link a name'],
  ['x', 'Docs', 'A name needs at least 2'],
  ['https://jenkins.company.az/job/online', 'Jenkins', 'This is an address'],
  ['grafana.company.az', 'Docs', 'This is an address'],
  ['Jenkins Online - Staging', 'Jenkins', 'Drop “Jenkins” from the front. The card already shows the group, so write “Online - Staging”'],
  ['jenkins: Online', 'Jenkins', 'Drop “Jenkins”'],
  ['Online WEB – Staging', 'Applications', 'Remove “–”'],
  ['Payments_API', 'Swagger', 'Remove “_”'],
  ['🚀 Deploy Dashboard', 'Jenkins', 'Remove “🚀”'],
  ['Online  WEB - Prod', 'Applications', 'Use one space'],
  ['Online WEB -Prod', 'Applications', 'Put a space on both sides'],
  ['Release Notes.', 'Docs', 'Remove the “.” at the end'],
  ['Payments API (v2', 'Swagger', 'Close the bracket'],
  ['Link', 'Docs', '“Link” doesn\'t say'],
  ['staging online', 'Jenkins', 'Put the environment last: “Online - Staging”'],
  ['Online WEB prod', 'Applications', 'Separate the environment with “ - ”: “Online WEB - Prod”'],
  ['Online WEB-Prod', 'Applications', 'Separate the environment with “ - ”: “Online WEB - Prod”'],
  ['Online WEB (production)', 'Applications', 'Separate the environment with “ - ”: “Online WEB - Prod”'],
  ['Online WEB - production', 'Applications', 'Write the environment as “Prod”, not “production”'],
  ['Online WEB - Dev', 'Applications', '“Dev” isn\'t an environment of this space'],
  ['Online WEB - Sandbox', 'Applications', '“Sandbox” isn\'t an environment of this space'],
  ['Online staging/prod', 'Applications', 'One link opens one environment'],
  ['Online - WEB - Prod', 'Applications', 'Use “ - ” once'],
  ['Staging', 'Applications', 'Name the thing'],
  ['onboarding checklist', 'Docs', 'Start with a capital letter: “Onboarding checklist”'],
  ['CONFLUENCE Space', 'Docs', 'Write “CONFLUENCE” as “Confluence”'],
  ['Onboarding Guide', 'Docs', 'Docs already has “Onboarding Guide”'],
  ['Online web - Staging', 'Applications', 'Write “Online web” as “Online WEB”'],
]
for (const [name, group, message] of bad) {
  test(`${JSON.stringify(name)} is refused`, () => assert.ok(check(name, group)?.startsWith(message), `got ${check(name, group)}`))
}

test('a space with its own environment accepts it', () => {
  assert.equal(check('Online WEB - Sandbox', 'Applications', ['Sandbox', 'Prod']), null)
  assert.equal(check('Online WEB - Dev', 'Applications', ['Dev', 'Prod']), null)
  assert.ok(check('Online WEB - development', 'Applications', ['Dev', 'Prod'])?.startsWith('Write the environment as “Dev”'))
})

test('file names become a name to start from', () => {
  assert.equal(nameFromFile('brand_guidelines-v2.final.pdf'), 'Brand guidelines v2 final')
  assert.equal(nameFromFile('Q3 Report.xlsx'), 'Q3 Report')
  assert.equal(check(nameFromFile('brand_guidelines-v2.final.pdf'), 'Docs'), null)
})
