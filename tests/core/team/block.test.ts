// The "Your team in Menkar" block every Claude session of a project in the orchestration mode
// starts with (decisions 1.148–1.154): its facts per session, the protocol written once in
// plugin/team/, and the agent's record that keeps everything agent-specific in one table.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'
import {
  TEAM_AGENTS,
  type TeamAgent,
  type TeamInput,
  teamAgent,
  teamBlock,
  teamFacts,
} from '../../../src/core/team/block'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const TEAM = join(ROOT, 'plugin', 'team')
const common = () => readFileSync(join(TEAM, 'common.md'), 'utf8')
const claudePart = () => readFileSync(join(TEAM, 'claude.md'), 'utf8')

const claude = (): TeamAgent => {
  const agent = teamAgent('claude')
  if (!agent) throw new Error('Claude has no team record')
  return agent
}

// An override of undefined removes the key: a session with no name, no parent.
type Over = { [K in keyof TeamInput]?: TeamInput[K] | undefined }

const input = (over: Over = {}): TeamInput => {
  const base: Record<string, unknown> = {
    project: 'menkar',
    name: 'packager',
    orchestrator: { name: 'set' },
    parent: { name: 'set', orchestrator: true },
    skills: [],
    context: { warn: 60, full: 90 },
  }
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) delete base[key]
    else base[key] = value
  }
  return base as unknown as TeamInput
}

const lines = (over: Over = {}) => teamFacts(input(over), claude()).split('\n')

// A full expert, the case the sizes below were measured on.
const EXPERT: TeamInput = input({
  role: 'Packaging',
  skills: [
    { name: 'packager', maintainer: true, found: true },
    { name: 'claude-cli', maintainer: false, maintainedBy: 'claude-cli', found: true },
  ],
})

const EXPERT_FACTS = `# Your team in Menkar
You are \`packager\`, a session of the Menkar project "menkar", in orchestration mode. Your role: "Packaging". Your parent is \`set\`, the orchestrator.
Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): \`packager\`, which you maintain (only you change it, with \`menkar:distill\`); \`claude-cli\`, read only (\`claude-cli\` maintains it).
When a session hands you a task, load \`menkar:worker\` first, with the Skill tool, by name, even if not in your listing yet.
Your parent decides when you renew; when your context (your row in \`list_sessions\`) passes 90%, tell it by name.`

describe('the facts', () => {
  test("the expert's facts, to the byte", () => {
    expect(teamFacts(EXPERT, claude())).toBe(EXPERT_FACTS)
  })

  // 1.151: line 2 says who the session is, with names in backticks and the project quoted.
  test.each<[string, Over, string]>([
    [
      'no name yet',
      { name: undefined, parent: undefined },
      'You are a new session of the Menkar project "menkar", in orchestration mode. You have no parent; the orchestrator is `set`.',
    ],
    [
      'no role, parent the orchestrator',
      {},
      'You are `packager`, a session of the Menkar project "menkar", in orchestration mode. Your parent is `set`, the orchestrator.',
    ],
    [
      'a role',
      { role: 'Packaging' },
      'You are `packager`, a session of the Menkar project "menkar", in orchestration mode. Your role: "Packaging". Your parent is `set`, the orchestrator.',
    ],
    [
      'the orchestrator',
      { name: 'set', orchestrator: 'self', parent: undefined },
      'You are `set`, a session of the Menkar project "menkar", in orchestration mode. You are its orchestrator.',
    ],
    [
      'another parent',
      { parent: { name: 'packager', orchestrator: false }, name: 'menkar-t3' },
      'You are `menkar-t3`, a session of the Menkar project "menkar", in orchestration mode. Your parent is `packager`; the orchestrator is `set`.',
    ],
    [
      'loose, with an orchestrator',
      { parent: undefined },
      'You are `packager`, a session of the Menkar project "menkar", in orchestration mode. You have no parent; the orchestrator is `set`.',
    ],
    [
      'no orchestrator marked',
      { orchestrator: null, parent: undefined },
      'You are `packager`, a session of the Menkar project "menkar", in orchestration mode. The project has no orchestrator yet.',
    ],
    [
      'a parent and no orchestrator marked',
      { orchestrator: null, parent: { name: 'packager', orchestrator: false }, name: 'helper' },
      'You are `helper`, a session of the Menkar project "menkar", in orchestration mode. Your parent is `packager`. The project has no orchestrator yet.',
    ],
  ])('line 2, %s', (_, over, expected) => {
    expect(lines(over)[1]).toBe(expected)
  })

  // A role is agent-written free text (start_session's role): one line, no delimiters of the
  // facts, at most 60 characters.
  test.each<[string, string, string]>([
    ['a newline', 'Packaging\nand releases', 'Packaging and releases'],
    ['a backtick', 'The `deb` keeper', 'The deb keeper'],
    ['a double quote', 'The "deb" keeper', 'The deb keeper'],
    ['61 characters', 'x'.repeat(61), `${'x'.repeat(59)}…`],
    ['60 characters', 'x'.repeat(60), 'x'.repeat(60)],
  ])('the role, %s', (_, role, shown) => {
    expect(lines({ role })[1]).toContain(` Your role: "${shown}". `)
  })

  test('a role that is only delimiters and spaces is no role', () => {
    expect(lines({ role: ' `"` \n' })[1]).not.toContain('Your role')
  })

  // Line 3: the skills to have loaded, in the human's order (1.152, 1.154).
  test.each<[string, Over, string | undefined]>([
    [
      'two maintained: the parenthesis once, on the first',
      {
        skills: [
          { name: 'packager', maintainer: true, found: true },
          { name: 'deb-notes', maintainer: true, found: true },
        ],
      },
      'Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): `packager`, which you maintain (only you change it, with `menkar:distill`); `deb-notes`, which you maintain.',
    ],
    [
      'read only with a maintainer',
      {
        skills: [
          { name: 'claude-cli', maintainer: false, maintainedBy: 'claude-cli', found: true },
        ],
      },
      'Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): `claude-cli`, read only (`claude-cli` maintains it).',
    ],
    [
      'read only with none',
      { skills: [{ name: 'review-branch', maintainer: false, found: true }] },
      'Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): `review-branch`, read only.',
    ],
    [
      'not found for this session',
      {
        skills: [
          { name: 'gone', maintainer: true, found: false },
          { name: 'review-branch', maintainer: false, found: true },
        ],
      },
      'Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): `gone` (not found: tell the human); `review-branch`, read only.',
    ],
    [
      "the orchestrator's starts with its own skill",
      {
        name: 'set',
        orchestrator: 'self',
        parent: undefined,
        skills: [{ name: 'review-branch', maintainer: false, found: true }],
      },
      'Skills to have loaded (any not loaded yet you load with the Skill tool, by name, even if not in your listing yet): `menkar:orchestrator`; `review-branch`, read only.',
    ],
    ['nothing to load: no line', {}, undefined],
  ])('line 3, %s', (_, over, expected) => {
    const skills = lines(over).find((line) => line.startsWith('Skills to have loaded'))
    expect(skills).toBe(expected)
  })

  // Line 4: a task handed over loads menkar:worker first (1.148); the orchestrator hands out.
  const WORKER =
    'When a session hands you a task, load `menkar:worker` first, with the Skill tool, by name, even if not in your listing yet.'
  test('line 4 is there for every session but the orchestrator', () => {
    expect(lines()).toContain(WORKER)
    expect(lines({ parent: undefined, orchestrator: null })).toContain(WORKER)
    expect(lines({ name: undefined, parent: undefined })).toContain(WORKER)
    expect(lines({ name: 'set', orchestrator: 'self', parent: undefined })).not.toContain(WORKER)
  })

  // Line 5: 1.109's context policy, one line per profile, at the human's ring thresholds (1.154 Q1).
  const MAINTAINED = [{ name: 'packager', maintainer: true, found: true }]
  const READ_ONLY = [{ name: 'review-branch', maintainer: false, found: true }]
  test.each<[string, Over, string | undefined, string | undefined]>([
    [
      'a parent',
      {},
      'Your parent decides when you renew; when your context (your row in `list_sessions`) passes 90%, tell it by name.',
      'Your parent decides when you renew; when your context (your row in `list_sessions`) passes 80%, tell it by name.',
    ],
    [
      'loose, a role, maintaining a skill',
      { parent: undefined, role: 'Packaging', skills: MAINTAINED },
      'You decide when you renew: when a consultation closes and your context (your row in `list_sessions`) is past 60%, run `menkar:distill`, then renew; prefer that to a compaction.',
      'You decide when you renew: when a consultation closes and your context (your row in `list_sessions`) is past 50%, run `menkar:distill`, then renew; prefer that to a compaction.',
    ],
    [
      'loose, a role, maintaining none',
      { parent: undefined, role: 'Packaging', skills: READ_ONLY },
      'You decide when you renew: when a consultation closes and your context (your row in `list_sessions`) is past 60%, renew; prefer that to a compaction.',
      'You decide when you renew: when a consultation closes and your context (your row in `list_sessions`) is past 50%, renew; prefer that to a compaction.',
    ],
    [
      'the orchestrator',
      { name: 'set', orchestrator: 'self', parent: undefined, role: 'Lead', skills: MAINTAINED },
      undefined,
      undefined,
    ],
    ['loose with no role', { parent: undefined, skills: MAINTAINED }, undefined, undefined],
  ])('line 5, %s', (_, over, at6090, at5080) => {
    const renew = (context: TeamInput['context']) =>
      lines({ ...over, context }).find((line) => /renew/.test(line) && !/^Skills/.test(line))
    expect(renew({ warn: 60, full: 90 })).toBe(at6090)
    expect(renew({ warn: 50, full: 80 })).toBe(at5080)
  })
})

// 1.201: a consultant tells the orchestrator, by its current name, what the human decided with it.
describe("the consultant's line", () => {
  const told = (name: string) =>
    `When the human decides something with you that moves a task, a plan, a merge or another session's work, send \`${name}\`, the orchestrator, by name, one line: "The human decided X about Y"; act no further than your own area.`
  const decided = (over: Over) => lines(over).filter((line) => line.includes('The human decided'))

  test("a consultant's facts end with it, naming the orchestrator", () => {
    expect(lines({ parent: undefined, role: 'Packaging' }).at(-1)).toBe(told('set'))
  })

  test("a Codex consultant's facts carry the same line", () => {
    const codex = teamAgent('codex')
    if (!codex) throw new Error('Codex has no team record')
    const facts = teamFacts(input({ parent: undefined, role: 'Packaging' }), codex)
    expect(facts.split('\n').at(-1)).toBe(told('set'))
  })

  test('after a rename it names the new orchestrator', () => {
    expect(
      decided({ parent: undefined, role: 'Packaging', orchestrator: { name: 'lead' } }),
    ).toEqual([told('lead')])
  })

  test.each<[string, Over]>([
    ['a worker', {}],
    ['an expert', { role: 'Packaging' }],
    ['a loose session with no role', { parent: undefined }],
    ['the orchestrator', { name: 'set', orchestrator: 'self', parent: undefined, role: 'Lead' }],
    [
      'a consultant with no orchestrator',
      { parent: undefined, role: 'Packaging', orchestrator: null },
    ],
  ])('%s has none', (_, over) => {
    expect(decided(over)).toEqual([])
  })
})

describe('the block', () => {
  test('teamBlock is the facts, the common part and the agent part, a blank line apart', () => {
    const block = teamBlock('# Facts\nA.\n', 'Common.\n', 'Part.\n')
    expect(block).toBe('# Facts\nA.\n\nCommon.\n\nPart.\n')
  })

  test('the protocol files hold their lines, and Claude names its part file', () => {
    expect(common()).toMatch(/^## How the team works\n/)
    expect(common()).toContain('[Menkar]')
    expect(claudePart()).toContain('`SendMessage`')
    expect(claude().part).toBe('claude.md')
  })

  // Growth of what every request carries is a deliberate change of this test.
  test('common and Claude parts are under 900 bytes, the expert block under 1,600', () => {
    const parts = Buffer.byteLength(common()) + Buffer.byteLength(claudePart())
    expect(parts).toBeGreaterThan(0)
    expect(parts).toBeLessThan(900)
    const block = teamBlock(teamFacts(EXPERT, claude()), common(), claudePart())
    expect(Buffer.byteLength(block)).toBeLessThan(1600)
  })

  // Codex's block names each skill by its SKILL.md, so the expert's carries three paths; measured
  // at 1,739 bytes with these.
  test('common and Codex parts are under 900 bytes, the Codex expert block under 2,000', () => {
    const codexPart = readFileSync(join(TEAM, 'codex.md'), 'utf8')
    const parts = Buffer.byteLength(common()) + Buffer.byteLength(codexPart)
    expect(Buffer.byteLength(codexPart)).toBeGreaterThan(0)
    expect(parts).toBeLessThan(900)
    const codex = teamAgent('codex')
    if (!codex) throw new Error('Codex has no team record')
    expect(codex.part).toBe('codex.md')
    const input: TeamInput = {
      ...EXPERT,
      skills: [
        { ...EXPERT.skills[0], file: '/home/ana/work/menkar/.claude/skills/packager/SKILL.md' },
        { ...EXPERT.skills[1], file: '/home/ana/work/menkar/.claude/skills/claude-cli/SKILL.md' },
      ] as TeamInput['skills'],
      ownSkills: '/opt/Menkar/resources/plugin/skills',
    }
    const block = teamBlock(teamFacts(input, codex), common(), codexPart)
    expect(block).toContain('/opt/Menkar/resources/plugin/skills/worker/SKILL.md')
    expect(Buffer.byteLength(block)).toBeLessThan(2000)
  })

  // A consultant carries one line more than an expert (1.201); measured at 1,821 bytes for Claude
  // and 2,086 for Codex with these.
  test('the consultant block is under 1,900 bytes for Claude and 2,200 for Codex', () => {
    const codex = teamAgent('codex')
    if (!codex) throw new Error('Codex has no team record')
    const consultant: TeamInput = input({
      parent: undefined,
      role: 'Packaging',
      skills: [
        {
          ...EXPERT.skills[0],
          file: '/home/ana/work/menkar/.claude/skills/packager/SKILL.md',
        },
        {
          ...EXPERT.skills[1],
          file: '/home/ana/work/menkar/.claude/skills/claude-cli/SKILL.md',
        },
      ] as TeamInput['skills'],
      ownSkills: '/opt/Menkar/resources/plugin/skills',
    })
    const claudeBlock = teamBlock(teamFacts(consultant, claude()), common(), claudePart())
    const codexPart = readFileSync(join(TEAM, 'codex.md'), 'utf8')
    const codexBlock = teamBlock(teamFacts(consultant, codex), common(), codexPart)
    expect(claudeBlock).toContain('The human decided')
    expect(codexBlock).toContain('The human decided')
    expect(Buffer.byteLength(claudeBlock)).toBeLessThan(1900)
    expect(Buffer.byteLength(codexBlock)).toBeLessThan(2200)
  })
})

// OpenCode names Menkar's skills by name, loaded through Menkar's MCP: no paths in its block.
// Measured at 1,450 bytes for the expert and 1,740 for the consultant with these.
test('common and OpenCode parts are under 900 bytes, its expert block under 1,600 and its consultant block under 1,900', () => {
  const opencode = teamAgent('opencode')
  if (!opencode) throw new Error('OpenCode has no team record')
  expect(opencode.part).toBe('opencode.md')
  const opencodePart = readFileSync(join(TEAM, 'opencode.md'), 'utf8')
  expect(Buffer.byteLength(opencodePart)).toBeGreaterThan(0)
  expect(Buffer.byteLength(common()) + Buffer.byteLength(opencodePart)).toBeLessThan(900)
  const expert = teamBlock(teamFacts(EXPERT, opencode), common(), opencodePart)
  expect(expert).toContain('`load_skill`')
  const consultant = teamBlock(
    teamFacts(input({ parent: undefined, role: 'Packaging', skills: EXPERT.skills }), opencode),
    common(),
    opencodePart,
  )
  expect(consultant).toContain('The human decided')
  expect(Buffer.byteLength(expert)).toBeLessThan(1600)
  expect(Buffer.byteLength(consultant)).toBeLessThan(1900)
})

describe("the agent's record", () => {
  // 1.135, 1.212: every agent has its record since plan 39 P3.2 gave Cursor one.
  test('every agent has a team record', () => {
    expect(teamAgent('cursor')).toBe(TEAM_AGENTS.cursor)
    expect(Object.keys(TEAM_AGENTS)).toEqual(['claude', 'cursor', 'codex', 'opencode'])
  })

  test("Claude's skills are referred to by name, Menkar's with the plugin's prefix", () => {
    expect(claude().skill('packager')).toBe('`packager`')
    expect(claude().own('worker')).toBe('`menkar:worker`')
  })

  // 1.135: shared code never names an agent. The agent's value, as a literal or a property
  // name, is allowed only inside the TEAM_AGENTS table.
  test("no 'claude' literal or property in src/core/team/ outside TEAM_AGENTS", () => {
    const folder = join(ROOT, 'src', 'core', 'team')
    const files = readdirSync(folder).filter((f) => f.endsWith('.ts'))
    expect(files).toContain('block.ts')
    const found: string[] = []
    let tableSeen = false
    for (const file of files) {
      const sf = ts.createSourceFile(
        file,
        readFileSync(join(folder, file), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === 'TEAM_AGENTS'
        ) {
          tableSeen = true
          return
        }
        if (ts.isImportDeclaration(node)) return
        const text =
          ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)
            ? node.text
            : (ts.isPropertyAssignment(node) || ts.isPropertySignature(node)) &&
                ts.isIdentifier(node.name)
              ? node.name.text
              : null
        if (text !== null && text === 'claude') found.push(`${file}: ${text}`)
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(tableSeen).toBe(true)
    expect(found).toEqual([])
  })
})
