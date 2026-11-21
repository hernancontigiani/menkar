// Codex's team block: given by `-c developer_instructions` with the user's own after it, kept by a
// resumed thread as it was recorded, rebuilt from the run's at a compaction, and told of a change
// through its waker. Its skills are named by their SKILL.md, since Codex loads a skill by reading it.
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { kitOf } from '../../../../src/core/agents/registry'
import type { LaunchContext, TeamDelivery } from '../../../../src/core/agents/types'
import type { Start } from '../../../../src/core/command'
import type { PostOutcome } from '../../../../src/core/control/post'
import { type TeamInput, teamFacts } from '../../../../src/core/team/block'
import {
  afterStartRecord,
  delivered,
  type PaneTeam,
  postWithTries,
  type TeamText,
  teamPost,
} from '../../../../src/core/team/posts'

const CONFIGS = join(import.meta.dirname, '..', '..', '..', 'data', 'agents', 'codex', 'config')
const ID = '019a3f1e-7c2d-7b40-9e11-2f4a6b8c0d1e'
const NEW: Start = { kind: 'new' }
const RESUME: Start = { kind: 'resume', id: ID }

const delivery = (): TeamDelivery => {
  const team = kitOf('codex').team
  if (!team) throw new Error('Codex has no team delivery')
  return team
}

const text = (role: string): TeamText => {
  const facts = `# Your team in Menkar\nYou are \`w\`. Your role: "${role}".`
  return { facts, block: `${facts}\n\n## How the team works\n- by name\n` }
}
const A = text('Packaging')
const B = text('Release')

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('what a start holds', () => {
  test('a new thread the block it is started with; a resume what it recorded, or nothing', () => {
    expect(delivery().heldAtStart(NEW, A, B)).toBe(A)
    expect(delivery().heldAtStart(RESUME, A, B)).toBe(B)
    expect(delivery().heldAtStart(RESUME, A, null)).toBeNull()
    expect(delivery().heldAtStart(RESUME, A)).toBeNull()
    expect(delivery().records).toBe(true)
    expect(kitOf('claude').team?.records).toBe(false)
  })
})

// The rule as main applies it, with Codex's start: a post only when what the thread holds differs
// from the facts now, delivered once the thread can be woken.
describe("the post rule with Codex's methods", () => {
  const step = (team: PaneTeam, current: TeamText | null) => {
    const post = teamPost(team.held, current)
    return { team: post ? delivered(team, current) : team, post }
  }
  const start = (s: Start, block: TeamText | null, recorded: TeamText | null): PaneTeam => ({
    started: block,
    held: delivery().heldAtStart(s, block, recorded),
  })

  test('a resume whose recorded facts are the current ones posts nothing', () => {
    expect(step(start(RESUME, A, A), A).post).toBeNull()
  })

  test('a resume whose facts changed while it was stopped is told once', () => {
    const first = step(start(RESUME, A, B), A)
    expect(first.post).toMatch(
      /^Team update: your facts are now:\nYou are `w`\. Your role: "Packaging"/,
    )
    expect(step(first.team, A).post).toBeNull()
  })

  test('a resume that recorded nothing is told the whole block', () => {
    expect(step(start(RESUME, A, null), A).post).toMatch(/your team instructions, replacing/)
  })

  test("a compaction rebuilds the run's block: what was told since is told again", () => {
    const told = step(start(NEW, A, null), B).team
    expect(told.held).toBe(B)
    const compacted = afterStartRecord(told, 'compact', true)
    expect(compacted.held).toBe(A)
    expect(step(compacted, B).post).toMatch(/Your role: "Release"/)
    // A resumed thread's compaction brings in the block this run passed, which is current.
    const resumed = afterStartRecord(start(RESUME, A, B), 'compact', true)
    expect(step(resumed, A).post).toBeNull()
  })

  test('a thread not wakeable yet is told once it is', async () => {
    const outcomes: PostOutcome[] = ['no session', 'no session', 'posted']
    const tell = vi.fn(async () => outcomes.shift() ?? 'posted')
    expect(await postWithTries(tell, async () => {})).toBe('posted')
    expect(tell).toHaveBeenCalledTimes(3)
  })
})

describe('how its skills are named', () => {
  const input: TeamInput = {
    project: 'menkar',
    name: 'w',
    orchestrator: 'self',
    skills: [
      { name: 'packager', maintainer: true, found: true, file: '/r/.claude/skills/pack/SKILL.md' },
      { name: 'gone', maintainer: false, found: false },
    ],
    context: { warn: 60, full: 90 },
    ownSkills: '/opt/Menkar/resources/plugin/skills',
  }

  test("the orchestrator's, a stored one by its file, a skill not found by its name", () => {
    const skills = teamFacts(input, delivery())
      .split('\n')
      .find((line) => line.startsWith('Skills'))
    expect(skills).toBe(
      'Skills to have loaded (any not loaded yet you load by reading its SKILL.md at the path given): `menkar:orchestrator` (`/opt/Menkar/resources/plugin/skills/orchestrator/SKILL.md`); `packager` (`/r/.claude/skills/pack/SKILL.md`), which you maintain (only you change it, with `menkar:distill` (`/opt/Menkar/resources/plugin/skills/distill/SKILL.md`)); `gone` (not found: tell the human).',
    )
  })

  test("a worker's line names Menkar's worker skill by its file", () => {
    const facts = teamFacts(
      { ...input, orchestrator: { name: 'set' }, parent: { name: 'set', orchestrator: true } },
      delivery(),
    )
    expect(facts).toContain(
      'When a session hands you a task, load `menkar:worker` (`/opt/Menkar/resources/plugin/skills/worker/SKILL.md`) first, by reading its SKILL.md at the path given.',
    )
  })
})

describe("how a start delivers: -c developer_instructions, Menkar's block then the user's own", () => {
  const root = () => mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'codex-team-'))

  async function context(config: string | null, block: string | null): Promise<LaunchContext> {
    const dir = root()
    const home = join(dir, 'home')
    await mkdir(home)
    if (config) copyFileSync(join(CONFIGS, config), join(home, 'config.toml'))
    vi.stubEnv('CODEX_HOME', home)
    const teamFile = join(dir, "team 'p1' $x.md")
    if (block !== null) await writeFile(teamFile, block)
    return { cli: '', env: {}, teamFile, paneFiles: join(dir, 'pane "p1"') }
  }

  // The plan's files written, then its line run by a real shell against a stand-in recording argv.
  async function argvOf(start: Start, ctx: LaunchContext): Promise<string[]> {
    const dir = root()
    const out = join(dir, 'argv')
    const cli = join(dir, 'codex')
    writeFileSync(cli, `#!/bin/sh\nfor a in "$@"; do printf '%s\\0' "$a"; done > '${out}'\n`)
    chmodSync(cli, 0o755)
    const plan = kitOf('codex').launch.plan(start, { ...ctx, cli })
    for (const file of plan.files ?? []) {
      await mkdir(dirname(file.path), { recursive: true })
      await writeFile(file.path, await file.text())
    }
    execFileSync('/bin/sh', ['-c', plan.words.join(' ')], { env: { PATH: '/usr/bin:/bin' } })
    return readFileSync(out, 'utf8').split('\0').slice(0, -1)
  }

  const instructions = (argv: readonly string[]): unknown[] =>
    argv
      .filter((arg, i) => argv[i - 1] === '-c' && arg.startsWith('developer_instructions='))
      .map((arg) => parse(arg).developer_instructions)

  const BLOCK = '# Your team in Menkar\nYou are `w`, "quoted" with $HOME and `id`.\n'
  const USER = '  Answer in English.\nKeep "quotes" and $HOME as written.\n'

  test("the block, a blank line, then the user's own, byte for byte, new and resumed", async () => {
    for (const start of [NEW, RESUME]) {
      const argv = await argvOf(start, await context('plain.toml', BLOCK))
      expect(instructions(argv)).toEqual([`${BLOCK.trimEnd()}\n\n${USER}`])
    }
  })

  test('the block alone when the user has none, or their file cannot be used', async () => {
    for (const config of [null, 'profile.toml', 'unparsable.toml', 'types.toml'])
      expect(instructions(await argvOf(NEW, await context(config, BLOCK))), String(config)).toEqual(
        [BLOCK.trimEnd()],
      )
  })

  test("the user's own alone when the block cannot be read", async () => {
    expect(instructions(await argvOf(NEW, await context('plain.toml', null)))).toEqual([USER])
  })

  test("without a team file nothing is passed, so the user's own stays in effect", async () => {
    const { teamFile: _, ...ctx } = await context('plain.toml', BLOCK)
    expect(instructions(await argvOf(NEW, ctx))).toEqual([])
    expect(kitOf('codex').launch.plan(NEW, { ...ctx, cli: 'codex' }).files).toEqual([])
  })
})
