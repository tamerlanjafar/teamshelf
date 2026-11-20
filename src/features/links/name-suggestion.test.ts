// Run with `pnpm test`.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { suggestName } from './name-suggestion.ts'

const cases: [title: string, group: string, siblings: string[], expected: string | null][] = [
  ['jenkins staging online', 'Jenkins', [], 'Online - Staging'],
  ['staging jenkins online', 'Jenkins', [], 'Online - Staging'],
  ['online staging', 'Jenkins', ['Online - Prod'], 'Online - Staging'],
  ['online staging', 'Jenkins', ['ONLINE - Prod'], 'ONLINE - Staging'],
  // A sibling that still has the group's name in front is the same thing.
  ['online staging', 'Jenkins', ['Jenkins Online - Prod'], 'Online - Staging'],
  // The group's name in front is dropped, with or without an environment.
  ['Jenkins Online - Prod', 'Jenkins', [], 'Online - Prod'],
  ['Jenkins Online', 'Jenkins', [], 'Online'],
  ['jenkins: Online', 'Jenkins', [], 'Online'],
  ['Jenkins dev to prod pipeline', 'Jenkins', [], 'dev to prod pipeline'],
  ['Online WEB prod', 'Applications', [], 'Online WEB - Prod'],
  ['Online WEB-Prod', 'Applications', [], 'Online WEB - Prod'],
  ['Online WEB (production)', 'Applications', [], 'Online WEB - Prod'],
  ['Online WEB - staging', 'Applications', [], 'Online WEB - Staging'],
  ['Online WEB – Staging', 'Applications', [], 'Online WEB - Staging'],
  ['Staging: BO Retail', 'Applications', [], 'BO Retail - Staging'],
  ['self-service terminal stg', 'Applications', [], 'Self-service Terminal - Staging'],
  // Fine as they are.
  ['Online WEB - Staging', 'Applications', [], null],
  ['Online Account Service', 'Swagger', [], null],
  ['Confluence', 'Docs', [], null],
  ['Online - Staging', 'Jenkins', [], null],
  ['Jenkins', 'Jenkins', [], null],
  ['Jenkinsfile Docs', 'Jenkins', [], null],
  ['Online Account Service', '', [], null],
  // Nothing to propose.
  ['Staging', 'Applications', [], null],
  ['Dev to prod pipeline', 'Jenkins', [], null],
]

for (const [title, group, siblings, expected] of cases) {
  test(`${JSON.stringify(title)} → ${JSON.stringify(expected)}`, () => assert.equal(suggestName(title, group, siblings), expected))
}
