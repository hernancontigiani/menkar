// Plan 33, decisions 7, 9 and 9b: the skills plugin Menkar passes to every Claude session.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { TOOL_NAMES } from '../../src/core/control/protocol'

const PLUGIN = join(import.meta.dirname, '..', '..', 'plugin')
const SKILLS = ['distill', 'orchestrator', 'specialize', 'worker']

function skill(name: string): { frontmatter: Record<string, string>; body: string } {
  const text = readFileSync(join(PLUGIN, 'skills', name, 'SKILL.md'), 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${name}: no frontmatter`)
  const frontmatter: Record<string, string> = {}
  for (const line of (match[1] ?? '').split('\n')) {
    const at = line.indexOf(':')
    if (at > 0) frontmatter[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { frontmatter, body: match[2] ?? '' }
}

// Tools are written in backticks; anything there shaped like a tool name must be a real one.
const toolsNamed = (body: string) =>
  [...body.matchAll(/`([a-z]+(?:_[a-z]+)+|renew)`/g)].map((m) => m[1] ?? '')

describe("Menkar's skills plugin", () => {
  test('the manifest names the plugin "menkar"', () => {
    const manifest = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'))
    expect(manifest.name).toBe('menkar')
  })

  test('exactly four skills: orchestrator, worker, distill, specialize', () => {
    expect(readdirSync(join(PLUGIN, 'skills')).sort()).toEqual(SKILLS)
  })

  test.each(SKILLS)('%s: its name is its folder, it has a description, under 200 lines', (name) => {
    const { frontmatter, body } = skill(name)
    expect(frontmatter.name).toBe(name)
    expect(frontmatter.description?.length ?? 0).toBeGreaterThan(20)
    expect(body.split('\n').length).toBeLessThan(200)
  })

  // Detail beyond 200 lines goes to reference files beside SKILL.md (1.82): Markdown only, each
  // one named by SKILL.md, and every one it names present.
  test.each(SKILLS)('%s: its reference files exist and are named by SKILL.md', (name) => {
    const { body } = skill(name)
    const beside = readdirSync(join(PLUGIN, 'skills', name)).filter((f) => f !== 'SKILL.md')
    for (const file of beside) expect(file).toMatch(/^[a-z0-9-]+\.md$/)
    const named = [...body.matchAll(/`([a-z0-9-]+\.md)`/g)].map((m) => m[1] ?? '')
    for (const file of beside) expect(named).toContain(file)
    for (const file of named) expect(beside).toContain(file)
  })

  test.each(SKILLS)('%s names no session or project of this repository', (name) => {
    const { frontmatter, body } = skill(name)
    const folder = join(PLUGIN, 'skills', name)
    const references = readdirSync(folder)
      .filter((f) => f !== 'SKILL.md')
      .map((f) => readFileSync(join(folder, f), 'utf8'))
    const text = [frontmatter.description, body, ...references].join('\n')
    for (const word of [
      /\bset\b/,
      /\bb1\b/i,
      /\bb2\b/i,
      /\bccai\b/i,
      /\bagent-tablet\b/i,
      /\blaburomenos\b/i,
    ])
      expect(text).not.toMatch(word)
  })

  // Decision 1.84: each of Menkar's skills declares what earns a line in it.
  test.each(SKILLS)('%s declares its admission criterion', (name) => {
    expect(skill(name).body).toMatch(/^What earns a line here: /m)
  })

  test("the orchestrator names Menkar's four tools; distill names renew", () => {
    const orchestrator = toolsNamed(skill('orchestrator').body)
    expect(orchestrator.length).toBeGreaterThanOrEqual(4)
    for (const tool of ['start_session', 'renew', 'list_sessions', 'last_reply'])
      expect(orchestrator).toContain(tool)
    expect(toolsNamed(skill('distill').body)).toContain('renew')
  })

  // Decision 1.167: the human's away state is cleared by the orchestrator alone, which the skill
  // and the guide both say; a worker is never told of the tool.
  test('the orchestrator and the guide name human_back; the worker does not', () => {
    expect(toolsNamed(skill('orchestrator').body)).toContain('human_back')
    expect(toolsNamed(skill('worker').body)).not.toContain('human_back')
    const guide = readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8')
    expect(toolsNamed(guide)).toContain('human_back')
    expect(TOOL_NAMES).toContain('human_back')
  })

  // Decision 1.90: the orchestration mode's guide ships in the plugin, readable by any session.
  test('the guide names the four topic tools, only tools the server lists, and no project of this repository', () => {
    const guide = readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8')
    const named = toolsNamed(guide)
    for (const tool of ['topic_add', 'topic_update', 'topic_close', 'topic_list', 'start_session'])
      expect(named).toContain(tool)
    for (const tool of named) expect(TOOL_NAMES).toContain(tool)
    for (const word of [/\bccai\b/i, /\blaburomenos\b/i, /\bagent-tablet\b/i])
      expect(guide).not.toMatch(word)
  })

  // Decision 1.113: the orchestrator adds and closes tasks, the worker reports on its own and never
  // closes it; the guide names every task tool.
  test('the task tools: the orchestrator adds and closes, the worker sets steps, reports and hands to review, the guide names all seven', () => {
    const folder = join(PLUGIN, 'skills', 'orchestrator')
    const orchestrator = toolsNamed(
      [
        skill('orchestrator').body,
        ...readdirSync(folder)
          .filter((f) => f !== 'SKILL.md')
          .map((f) => readFileSync(join(folder, f), 'utf8')),
      ].join('\n'),
    )
    for (const tool of ['task_add', 'task_close', 'task_star']) expect(orchestrator).toContain(tool)
    const worker = toolsNamed(skill('worker').body)
    for (const tool of ['task_steps', 'task_progress', 'task_review'])
      expect(worker).toContain(tool)
    for (const tool of ['task_add', 'task_close', 'task_star']) expect(worker).not.toContain(tool)
    const guide = toolsNamed(readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8'))
    const tasks = TOOL_NAMES.filter((x) => x.startsWith('task_'))
    expect(tasks).toHaveLength(7)
    for (const tool of tasks) expect(guide).toContain(tool)
  })

  // Decisions 1.118–1.120 and 1.123: the orchestrator parks and resumes workers by name and sets the
  // cap only when the human asks; the guide tells the person the same; every tool named exists.
  test('workers per task: the orchestrator names park_session, resume_session and set_workers_cap, which exist; the guide names all three; a worker never distills an expert’s skill', () => {
    const folder = join(PLUGIN, 'skills', 'orchestrator')
    const files = readdirSync(folder).filter((f) => f !== 'SKILL.md')
    expect(files).toContain('workers.md')
    const workers = readFileSync(join(folder, 'workers.md'), 'utf8')
    const named = toolsNamed(workers).filter((x) => x !== 'waiting_on')
    for (const tool of ['start_session', 'park_session', 'resume_session', 'set_workers_cap'])
      expect(named).toContain(tool)
    for (const tool of named) expect(TOOL_NAMES).toContain(tool)
    expect(workers).toMatch(/`set_workers_cap` only when the human asks for it explicitly/)
    expect(skill('orchestrator').body).toMatch(/`task_star`[^.]*only when they ask/)
    expect(skill('orchestrator').body).toContain('`workers.md`')
    const guide = toolsNamed(readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8'))
    for (const tool of ['park_session', 'resume_session', 'set_workers_cap'])
      expect(guide).toContain(tool)
    expect(skill('worker').body).toMatch(/never edit or distill it/)
  })

  test.each(SKILLS)('%s names only tools the MCP server lists', (name) => {
    for (const tool of toolsNamed(skill(name).body)) expect(TOOL_NAMES).toContain(tool)
  })

  // Decision 1.150: how the team talks is written once, in the team block (`plugin/team/`); a
  // skill that repeated it would drift from it.
  test.each(SKILLS)('%s holds no communication line: the team block carries them', (name) => {
    const texts = [skill(name).body, ...references(name)]
    const description = skill(name).frontmatter.description ?? ''
    if (name !== 'orchestrator') texts.push(description)
    else expect(description.replace('menkar:orchestrator', '')).not.toMatch(/load `menkar:/)
    for (const text of texts)
      for (const line of COMMUNICATION_LINES) expect(normalized(text)).not.toMatch(line)
  })

  // Decision 1.157 (S1): with the mode off a skill still reaches the protocol, through one pointer.
  test.each(['orchestrator', 'worker', 'distill'])(
    '%s points to the team block, else to the plugin’s team files',
    (name) => {
      expect(normalized(skill(name).body)).toContain(TEAM_POINTER)
    },
  )

  // Decision 1.152: specialize binds any project, so it names nothing of Menkar's.
  test('specialize is generic: no Menkar, no orchestrator, no SendMessage, no Menkar tool', () => {
    const { frontmatter, body } = skill('specialize')
    const text = [frontmatter.description, body, ...references('specialize')].join('\n')
    expect(text.length).toBeGreaterThan(1000)
    expect(text).not.toMatch(/menkar/i)
    expect(text).not.toMatch(/orchestrat/i)
    expect(text).not.toContain('SendMessage')
    for (const tool of TOOL_NAMES) expect(text).not.toContain(`\`${tool}\``)
  })

  // Decision 1.152: a session edits only the skills it maintains, never a read-only one.
  test('distill edits only the skills the session maintains', () => {
    const { body } = skill('distill')
    expect(body).toMatch(/read.only/)
    expect(body).toMatch(/maintain/)
  })

  // Decisions 1.148 (every request that needs more than a short answer is a task, to a consultant
  // too; waiting on something outside) and 1.149 (the horizon of deferred work): in SKILL.md, which
  // is always read, not in workers.md, read only when handing out.
  test('the orchestrator gives consultants tasks, sets outside waits as waiting, and reads the horizon of deferred work', () => {
    const body = normalized(skill('orchestrator').body)
    expect(body).toMatch(/to a worker, an expert or a consultant/)
    expect(body).toMatch(/a short question to a consultant needs none/)
    expect(body).toMatch(/waiting on something outside[^.]*waiting/)
    const workers = readFileSync(join(PLUGIN, 'skills', 'orchestrator', 'workers.md'), 'utf8')
    for (const horizon of ['tomorrow', 'in the future', 'another day']) {
      expect(body).toContain(horizon)
      expect(workers).not.toContain(horizon)
    }
  })

  test('no skill and not the guide says "keeper"; the guide gives consultants tasks', () => {
    const guide = readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8')
    for (const text of [guide, ...SKILLS.flatMap((n) => [skill(n).body, ...references(n)])])
      expect(text).not.toMatch(/keeper/i)
    expect(guide).not.toContain('Consultants get no tasks')
  })
})

const COMMUNICATION_LINES = [
  /SendMessage/,
  /last message/i,
  /never by (an )?id/i,
  /wakes only/i,
  /load `menkar:/,
]

const TEAM_POINTER =
  'How the team talks: the "Your team in Menkar" section of your instructions; if you have none, read `team/common.md` and `team/claude.md` in Menkar\'s plugin folder (one level up from `skills/`).'

// A sentence wrapped over lines reads as one line.
const normalized = (text: string) => text.replace(/\s+/g, ' ')

function references(name: string): string[] {
  const folder = join(PLUGIN, 'skills', name)
  return readdirSync(folder)
    .filter((f) => f !== 'SKILL.md')
    .map((f) => readFileSync(join(folder, f), 'utf8'))
}
