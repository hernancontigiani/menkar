// The skills "Configure role…" lists and the team block checks (decisions 1.154, 1.157): a
// session's own folder up to its repository root, plus the user's; read only.
import { chmod, lstat, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { type FoundSkill, foundFor, listSkills } from '../../../src/core/team/skills'

let root = ''
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'menkar-skills-'))
})
afterEach(async () => {
  await chmod(join(root, 'user', 'skills', 'locked'), 0o755).catch(() => undefined)
  await rm(root, { recursive: true, force: true })
})

async function skillFile(dir: string, frontmatter: string, body = 'Body.\n') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n${body}`)
}

// repo/          a repository (.git a directory), with a skill at its root
//   app/         a project folder inside it, with its own skill
// other/         a project folder in no repository: every parent's skills load, as Claude Code
//                does (measured on 2.1.325), so it also lists `above`
// .claude/       above the repository: never listed for `app`
// user/skills/   the user's folder
async function tree() {
  const repo = join(root, 'repo')
  const app = join(repo, 'app')
  const other = join(root, 'other')
  const user = join(root, 'user', 'skills')
  await mkdir(join(repo, '.git'), { recursive: true })
  await skillFile(join(repo, '.claude/skills/review'), 'name: review-branch\ndescription: Reviews.')
  await skillFile(join(app, '.claude/skills/packager'), 'description: "Packages the app."')
  await skillFile(join(root, '.claude/skills/above'), 'description: Above the repository.')
  await skillFile(join(other, '.claude/skills/claude-cli'), `description: ${'x'.repeat(300)}`)
  await skillFile(join(user, 'mine'), 'name: mine\ndescription: >\n  Folded\n  over lines.')
  await skillFile(join(root, 'elsewhere', 'linked'), 'description: Through a link.')
  await symlink(join(root, 'elsewhere', 'linked'), join(user, 'linked'))
  await skillFile(join(user, 'locked'), 'description: Unreadable.')
  await chmod(join(user, 'locked'), 0o000)
  await mkdir(join(user, 'no-skill-file'))
  await skillFile(
    join(user, 'manual'),
    'description: Only by hand.\ndisable-model-invocation: true',
  )
  return { repo, app, other, user }
}

const names = (skills: readonly FoundSkill[]) => skills.map((s) => s.name)

async function snapshot(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { recursive: true })) {
    const at = join(dir, entry)
    const info = await lstat(at).catch(() => null)
    out.push(`${entry} ${info?.mtimeMs ?? 'unreadable'}`)
  }
  return out.sort()
}

describe('the skills Menkar finds', () => {
  test('names, places and descriptions; a frontmatter name wins over the folder', async () => {
    const { app, other, user } = await tree()
    const listed = await listSkills({ folders: [app, other], user })
    expect(listed.folders[other]?.[0]).toEqual({
      name: 'claude-cli',
      description: 'x'.repeat(200),
      source: 'project',
      place: join(other, '.claude/skills'),
    })
    expect(listed.user.find((s) => s.name === 'mine')).toEqual({
      name: 'mine',
      description: 'Folded over lines.',
      source: 'user',
      place: user,
    })
    expect(listed.folders[app]?.find((s) => s.name === 'packager')?.description).toBe(
      'Packages the app.',
    )
  })

  test('a folder inside a repository lists its parents up to the .git directory, nothing above', async () => {
    const { repo, app, user } = await tree()
    const listed = await listSkills({ folders: [app], user })
    expect(names(listed.folders[app] ?? [])).toEqual(['packager', 'review-branch'])
    expect(listed.folders[app]?.[1]?.place).toBe(join(repo, '.claude/skills'))
  })

  test('a folder in no repository lists every parent; the nearest of one name wins', async () => {
    const { other, user } = await tree()
    await skillFile(join(root, '.claude/skills/claude-cli'), 'description: Farther.')
    const listed = await listSkills({ folders: [other], user })
    expect(names(listed.folders[other] ?? [])).toEqual(['claude-cli', 'above'])
    expect(listed.folders[other]?.[0]?.place).toBe(join(other, '.claude/skills'))
  })

  test('a .git file (a worktree) is a repository root too', async () => {
    const wt = join(root, 'wt')
    const sub = join(wt, 'sub')
    await mkdir(sub, { recursive: true })
    await writeFile(join(wt, '.git'), 'gitdir: /elsewhere\n')
    await skillFile(join(wt, '.claude/skills/deploy'), 'description: Deploys.')
    await skillFile(join(root, '.claude/skills/above'), 'description: Above.')
    const listed = await listSkills({ folders: [sub], user: join(root, 'none') })
    expect(names(listed.folders[sub] ?? [])).toEqual(['deploy'])
    expect(listed.user).toEqual([])
  })

  test('a symlinked skill is found; unreadable, no SKILL.md or manual-only skills are not', async () => {
    const { user } = await tree()
    const listed = await listSkills({ folders: [], user })
    expect(names(listed.user)).toEqual(['linked', 'mine'])
  })

  test('nothing under the folders it reads is written', async () => {
    const { app, other, user } = await tree()
    await chmod(join(user, 'locked'), 0o755)
    const before = await snapshot(root)
    await chmod(join(user, 'locked'), 0o000)
    await listSkills({ folders: [app, other], user })
    await chmod(join(user, 'locked'), 0o755)
    expect(before.length).toBeGreaterThan(10)
    expect(await snapshot(root)).toEqual(before)
  })

  test("a session's skills are its own folder's chain plus the user's, never another folder's", async () => {
    const { app, other, user } = await tree()
    const listed = await listSkills({ folders: [app, other], user })
    expect(names(foundFor(app, listed))).toEqual(['packager', 'review-branch', 'linked', 'mine'])
    expect(names(foundFor(other, listed))).toEqual(['claude-cli', 'above', 'linked', 'mine'])
    expect(names(foundFor(dirname(app), listed))).toEqual(['linked', 'mine'])
  })
})
