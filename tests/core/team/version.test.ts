// Decision 1.157 (Q4): the team flags need Claude Code 2.1.267 or later, the version that
// adds --system-prompt-snapshot (its docs say 2.1.257; the changelog's later one is the safe floor).
// An older CLI given an unknown flag exits at once, so below the floor no flag is passed.
import { expect, test } from 'vitest'
import { claudeVersion, TEAM_FLOOR, teamFlagsAllowed } from '../../../src/core/team/version'

test('the floor is 2.1.267', () => {
  expect(TEAM_FLOOR).toBe('2.1.267')
})

test.each([
  ['2.1.325 (Claude Code)\n', '2.1.325'],
  ['2.1.267', '2.1.267'],
  ['  10.0.0 (Claude Code)', '10.0.0'],
  ['Claude Code', null],
  ['', null],
])('%j reads as %s', (output, version) => {
  expect(claudeVersion(output)).toBe(version)
})

test.each([
  ['2.1.267', true],
  ['2.1.325', true],
  ['2.2.0', true],
  ['3.0.0', true],
  ['2.1.266', false],
  ['2.1.257', false],
  ['2.0.999', false],
  ['1.9.400', false],
])('%s may carry the team flags: %s', (version, allowed) => {
  expect(teamFlagsAllowed(version)).toBe(allowed)
})
