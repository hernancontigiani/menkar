import { describe, expect, test } from 'vitest'
import { releaseNotes } from '../../scripts/release-notes.mjs'
import { releaseVersion } from '../../scripts/release-version.mjs'

describe('releaseVersion: the tag is v + package.json’s version, nothing else', () => {
  test('v1.0.0 with 1.0.0 is accepted', () => {
    expect(releaseVersion('v1.0.0', '1.0.0')).toBe('1.0.0')
  })

  test.each([
    ['v1.0.0', '0.1.0', /does not match package.json's version 0.1.0/],
    ['v1.0', '1.0.0', /not v<major>.<minor>.<patch>/],
    ['1.0.0', '1.0.0', /not v<major>.<minor>.<patch>/],
    ['v1.0.0-rc.1', '1.0.0', /not v<major>.<minor>.<patch>/],
    ['v1.0.0 ', '1.0.0', /not v<major>.<minor>.<patch>/],
  ])('%s with %s is refused', (tag, version, reason) => {
    expect(() => releaseVersion(tag, version)).toThrow(reason)
  })
})

const CHANGELOG = `# Changelog

## 11.0.0 — 2031-01-01

Far future.

## 1.0.01

Not a version of ours.

## [1.0.1] - 2027-02-01

- A fix.

## 1.0.0 — 2026-12-01

The first release.

- Install from the repository.

## 0.9.0

## 0.8.0
Old.
`

describe('releaseNotes: the version’s CHANGELOG.md section, up to the next', () => {
  test('the body under "## 1.0.0 — date", trimmed, up to the next ## heading', () => {
    expect(releaseNotes(CHANGELOG, '1.0.0')).toBe(
      'The first release.\n\n- Install from the repository.',
    )
  })

  test('a bracketed heading, as Keep a Changelog writes it', () => {
    expect(releaseNotes(CHANGELOG, '1.0.1')).toBe('- A fix.')
  })

  test('the last section runs to the end of the file', () => {
    expect(releaseNotes(CHANGELOG, '0.8.0')).toBe('Old.')
  })

  test('a missing section is refused, and 1.0.0 matches neither 11.0.0 nor 1.0.01', () => {
    expect(() => releaseNotes(CHANGELOG, '2.0.0')).toThrow('CHANGELOG.md has no section for 2.0.0')
    expect(() => releaseNotes('## 11.0.0\n\nx\n\n## 1.0.01\n\ny\n', '1.0.0')).toThrow(
      'no section for 1.0.0',
    )
  })

  test('an empty section is refused', () => {
    expect(() => releaseNotes(CHANGELOG, '0.9.0')).toThrow('section for 0.9.0 is empty')
  })
})
