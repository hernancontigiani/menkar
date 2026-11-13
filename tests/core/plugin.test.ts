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
  test('the task tools: the orchestrator adds and closes, the worker sets steps, reports and hands to review, the guide names all six', () => {
    const folder = join(PLUGIN, 'skills', 'orchestrator')
    const orchestrator = toolsNamed(
      [
        skill('orchestrator').body,
        ...readdirSync(folder)
          .filter((f) => f !== 'SKILL.md')
          .map((f) => readFileSync(join(folder, f), 'utf8')),
      ].join('\n'),
    )
    for (const tool of ['task_add', 'task_close']) expect(orchestrator).toContain(tool)
    const worker = toolsNamed(skill('worker').body)
    for (const tool of ['task_steps', 'task_progress', 'task_review'])
      expect(worker).toContain(tool)
    for (const tool of ['task_add', 'task_close']) expect(worker).not.toContain(tool)
    const guide = toolsNamed(readFileSync(join(PLUGIN, 'guide', 'orchestration-mode.md'), 'utf8'))
    const tasks = TOOL_NAMES.filter((x) => x.startsWith('task_'))
    expect(tasks).toHaveLength(6)
    for (const tool of tasks) expect(guide).toContain(tool)
  })

  test.each(SKILLS)('%s names only tools the MCP server lists', (name) => {
    for (const tool of toolsNamed(skill(name).body)) expect(TOOL_NAMES).toContain(tool)
  })
})
