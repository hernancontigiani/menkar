import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, test } from 'vitest'

type Step = { uses?: string; run?: string; with?: Record<string, unknown> }
type Job = {
  needs?: string[]
  uses?: string
  with?: Record<string, unknown>
  env?: Record<string, unknown>
  steps?: Step[]
}
type Release = {
  on: { workflow_dispatch: { inputs: Record<string, { required?: boolean; type?: string }> } }
  env: Record<string, unknown>
  jobs: Record<string, Job>
}

const TEXT = readFileSync(join(__dirname, '../../.github/workflows/release.yml'), 'utf8')
const release = load(TEXT) as Release
// Run by hand the tag is the input; pushed, it is the ref. Read the same way everywhere, turning
// the push trigger on changes nothing else.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template
const THE_TAG = '${{ inputs.tag || github.ref_name }}'

describe('release.yml', () => {
  test('its one input is the tag, required', () => {
    const inputs = release.on.workflow_dispatch.inputs
    expect(Object.keys(inputs)).toEqual(['tag'])
    expect(inputs.tag).toMatchObject({ required: true, type: 'string' })
  })

  test('every job reads the tag through inputs.tag || github.ref_name, and only that way', () => {
    expect(release.env.TAG).toBe(THE_TAG)
    expect(release.jobs.checks?.with).toEqual({ ref: THE_TAG, base: THE_TAG })
    for (const name of ['verify', 'package']) {
      const checkout = release.jobs[name]?.steps?.find((s) =>
        s.uses?.startsWith('actions/checkout'),
      )
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a template
      expect(checkout?.with?.ref, name).toBe('${{ env.TAG }}')
    }
    const expressions = TEXT.match(/\$\{\{[^}]*\}\}/g) ?? []
    expect(expressions.length).toBeGreaterThan(5)
    for (const expression of expressions) {
      if (/inputs\.tag|github\.ref_name/.test(expression)) expect(expression).toBe(THE_TAG)
    }
  })

  test('it releases only after the tag is verified and the tagged tree is gated', () => {
    expect(release.jobs.checks?.uses).toBe('./.github/workflows/checks.yml')
    expect(release.jobs.package?.needs).toEqual(['verify', 'checks'])
    const verify = (release.jobs.verify?.steps ?? []).map((s) => s.run ?? '').join('\n')
    expect(verify).toContain('node scripts/release-version.mjs "$TAG"')
    expect(verify).toContain('git merge-base --is-ancestor "$TAG^{commit}" origin/main')
    expect(verify).toContain('node scripts/release-notes.mjs "$VERSION"')
  })

  test('the package job builds, checks and smoke-tests the .deb and the .rpm, then drafts', () => {
    const runs = (release.jobs.package?.steps ?? []).map((s) => s.run ?? '')
    const at = (command: string) => runs.findIndex((r) => r.includes(command))
    expect(runs).toContain('npm run package -- --targets deb,rpm')
    expect(runs).toContain('npm run package:check -- --targets deb,rpm')
    expect(at('npm run package:check')).toBeGreaterThan(at('npm run package -- '))
    expect(at('npm run package:smoke')).toBeGreaterThan(at('npm run package:check'))
    expect(at('gh release create')).toBeGreaterThan(at('npm run package:smoke'))
    expect(runs.find((r) => r.includes('apt-get install'))).toMatch(/\brpm\b/)
    const draft = runs[at('gh release create')] ?? ''
    expect(draft).toContain('--draft --verify-tag')
    // The shell's variables in the step, not template placeholders.
    const VERSION = '$' + '{VERSION}'
    for (const asset of [
      `menkar_${VERSION}_amd64.deb`,
      `menkar-${VERSION}.x86_64.rpm`,
      'SHA256SUMS',
    ])
      expect(draft).toContain(asset)
  })
})
