import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { describe, expect, test } from 'vitest'

const DIR = join(__dirname, '../../.github/workflows')

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Env }
type Env = Record<string, unknown>
type Job = {
  uses?: string
  if?: string
  env?: Env
  environment?: string | { name?: string }
  permissions?: Record<string, string> | string
  steps?: Step[]
}
type Workflow = {
  on?: Record<string, unknown> | string | string[]
  permissions?: Record<string, string> | string
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean }
  jobs?: Record<string, Job>
}

const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/

function triggers(workflow: Workflow): string[] {
  const on = workflow.on
  if (on === undefined) return []
  if (typeof on === 'string') return [on]
  return Array.isArray(on) ? on : Object.keys(on)
}

function writes(permissions: Job['permissions']): boolean {
  if (permissions === 'write-all') return true
  return typeof permissions === 'object' && permissions.contents === 'write'
}

/**
 * What a workflow breaks of the rules every one of them holds. Until the first release nothing runs
 * on its own: a workflow is started by hand or called by another, never by a push, a PR or a tag.
 */
function problems(file: string, workflow: Workflow): string[] {
  const found: string[] = []
  for (const trigger of triggers(workflow)) {
    if (trigger !== 'workflow_dispatch' && trigger !== 'workflow_call')
      found.push(`${file}: triggered by ${trigger}; until the first release only by hand`)
    if (trigger === 'pull_request_target')
      found.push(`${file}: pull_request_target runs fork code with the base's secrets`)
  }
  if (writes(workflow.permissions)) found.push(`${file}: contents: write for every job`)
  for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
    const where = `${file} job ${id}`
    const steps = job.steps ?? []
    for (const uses of [job.uses, ...steps.map((step) => step.uses)]) {
      if (uses !== undefined && !uses.startsWith('./') && !PINNED.test(uses))
        found.push(`${where}: ${uses} is not pinned to a full commit SHA`)
    }
    if (writes(job.permissions) && !(file === 'release.yml' && id === 'package'))
      found.push(`${where}: contents: write`)
    const environment =
      typeof job.environment === 'string' ? job.environment : job.environment?.name
    if (environment === 'packages' && file !== 'publish.yml')
      found.push(`${where}: names the packages environment`)
    const packageStep = steps.find((step) => /\bnpm run package\b/.test(step.run ?? ''))
    if (packageStep !== undefined) {
      const flavour = packageStep.env?.MENKAR_FLAVOR_BUILD ?? job.env?.MENKAR_FLAVOR_BUILD
      if (flavour !== 'menkar')
        found.push(`${where}: npm run package without MENKAR_FLAVOR_BUILD: menkar`)
      const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'))
      if (checkout?.with?.['fetch-depth'] !== 0)
        found.push(`${where}: npm run package without a checkout of fetch-depth: 0`)
    }
  }
  return found
}

const files = readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name))
const parsed = (name: string) => load(readFileSync(join(DIR, name), 'utf8')) as Workflow

describe('the workflows', () => {
  test('there are workflows to check', () => {
    expect(files).toEqual(expect.arrayContaining(['checks.yml', 'pr.yml']))
  })

  test.each(files)('%s holds every rule', (name) => {
    expect(problems(name, parsed(name))).toEqual([])
  })

  test('pr.yml skips a draft PR and cancels the previous run of the same PR or ref', () => {
    const pr = parsed('pr.yml')
    expect(pr.concurrency?.['cancel-in-progress']).toBe(true)
    expect(pr.concurrency?.group).toContain('github.event.pull_request.number')
    expect(pr.jobs?.checks?.if).toBe(
      "github.event_name != 'pull_request' || !github.event.pull_request.draft",
    )
    expect(pr.jobs?.checks?.uses).toBe('./.github/workflows/checks.yml')
  })
})

describe('the rules catch what they are for', () => {
  const sample = (yaml: string, file = 'sample.yml') => problems(file, load(yaml) as Workflow)

  test('a push, PR or tag trigger is refused until the first release', () => {
    expect(sample('on:\n  pull_request:\n  workflow_dispatch:\n')).toEqual([
      'sample.yml: triggered by pull_request; until the first release only by hand',
    ])
    expect(sample('on: push\n')).toEqual([
      'sample.yml: triggered by push; until the first release only by hand',
    ])
    expect(sample('on: [pull_request_target]\n')).toEqual([
      'sample.yml: triggered by pull_request_target; until the first release only by hand',
      "sample.yml: pull_request_target runs fork code with the base's secrets",
    ])
  })

  test('an action by tag is refused; a SHA or a local workflow passes', () => {
    const yaml = `
on: workflow_dispatch
jobs:
  a:
    uses: ./.github/workflows/checks.yml
  b:
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
`
    expect(sample(yaml)).toEqual([
      'sample.yml job b: actions/checkout@v7 is not pinned to a full commit SHA',
    ])
  })

  test('contents: write and the packages environment only where they belong', () => {
    const yaml = `
on: workflow_dispatch
jobs:
  package:
    permissions: { contents: write }
  upload:
    environment: packages
`
    expect(sample(yaml, 'release.yml')).toEqual([
      'release.yml job upload: names the packages environment',
    ])
    expect(sample(yaml, 'other.yml')).toEqual([
      'other.yml job package: contents: write',
      'other.yml job upload: names the packages environment',
    ])
    expect(sample('on: workflow_dispatch\npermissions: write-all\n')).toEqual([
      'sample.yml: contents: write for every job',
    ])
  })

  test('npm run package needs the menkar flavour and the full history', () => {
    const yaml = `
on: workflow_dispatch
jobs:
  package:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - run: npm run package -- --targets deb,rpm
`
    expect(sample(yaml)).toEqual([
      'sample.yml job package: npm run package without MENKAR_FLAVOR_BUILD: menkar',
      'sample.yml job package: npm run package without a checkout of fetch-depth: 0',
    ])
    const right = `
on: workflow_dispatch
jobs:
  package:
    env: { MENKAR_FLAVOR_BUILD: menkar }
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with: { fetch-depth: 0 }
      - run: npm run package -- --targets deb,rpm
`
    expect(sample(right)).toEqual([])
  })
})
