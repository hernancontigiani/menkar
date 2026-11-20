import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { log } from '../log'

export type SkillSource = 'project' | 'user'

export interface FoundSkill {
  readonly name: string
  readonly description: string
  readonly source: SkillSource
  // The `skills` folder it was found in.
  readonly place: string
  // Its SKILL.md, for an agent that loads a skill by reading it.
  readonly file: string
}

export interface SkillPlaces {
  // The sessions' start folders.
  readonly folders: readonly string[]
  // The user's skills folder.
  readonly user: string
}

export interface ListedSkills {
  // By start folder, as given: what Claude Code loads from a session started there.
  readonly folders: Readonly<Record<string, readonly FoundSkill[]>>
  readonly user: readonly FoundSkill[]
}

const DESCRIPTION_CHARS = 200

const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined

const absent = (error: unknown) => {
  const code = errorCode(error)
  return code === 'ENOENT' || code === 'ENOTDIR'
}

const unquote = (value: string) => (/^(["']).*\1$/s.test(value) ? value.slice(1, -1) : value)

// Only the frontmatter's top-level scalars, folded (`>`) and literal (`|`) blocks included: a
// skill's name, description and whether the model may invoke it are all that is read.
export function frontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return {}
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (end < 0) return {}
  const fields: Record<string, string> = {}
  for (let i = 1; i < end; i++) {
    const match = /^([\w-]+):\s*(.*)$/.exec(lines[i] ?? '')
    if (!match?.[1]) continue
    const value = (match[2] ?? '').trim()
    if (/^[>|][+-]?$/.test(value)) {
      const block: string[] = []
      while (i + 1 < end && /^(\s|$)/.test(lines[i + 1] ?? ''))
        block.push((lines[++i] ?? '').trim())
      fields[match[1]] = block.join(value.startsWith('>') ? ' ' : '\n').trim()
    } else fields[match[1]] = unquote(value)
  }
  return fields
}

async function readSkill(
  place: string,
  dir: string,
  source: SkillSource,
): Promise<FoundSkill | null> {
  const at = join(place, dir)
  try {
    if (!(await stat(at)).isDirectory()) return null
    const fields = frontmatter(await readFile(join(at, 'SKILL.md'), 'utf8'))
    // The team block could not get it loaded: only the user can invoke it.
    if (fields['disable-model-invocation'] === 'true') return null
    return {
      name: fields.name?.trim() || dir,
      description: (fields.description ?? '').slice(0, DESCRIPTION_CHARS),
      source,
      place,
      file: join(at, 'SKILL.md'),
    }
  } catch (error) {
    if (!absent(error)) log.warn('skill not readable; skipped', { path: at, error })
    return null
  }
}

async function readPlace(place: string, source: SkillSource): Promise<FoundSkill[]> {
  let dirs: string[]
  try {
    dirs = await readdir(place)
  } catch (error) {
    if (!absent(error)) log.warn('skills folder not readable; skipped', { path: place, error })
    return []
  }
  const skills = await Promise.all(dirs.sort().map((dir) => readSkill(place, dir, source)))
  return skills.filter((s): s is FoundSkill => s !== null)
}

async function isRepositoryRoot(folder: string): Promise<boolean> {
  try {
    await stat(join(folder, '.git'))
    return true
  } catch (error) {
    if (!absent(error)) log.warn('.git not readable; not a repository root', { folder, error })
    return false
  }
}

// The folder and each parent up to its repository root; with no repository, up to `/`, as Claude
// Code walks them.
async function chain(folder: string): Promise<string[]> {
  const levels: string[] = []
  let at = resolve(folder)
  for (;;) {
    levels.push(at)
    if (await isRepositoryRoot(at)) return levels
    const up = dirname(at)
    if (up === at) return levels
    at = up
  }
}

async function folderSkills(folder: string, user: string): Promise<FoundSkill[]> {
  const places = (await chain(folder))
    .map((level) => join(level, '.claude', 'skills'))
    // A chain through the home folder reaches the user's own skills, listed as the user's.
    .filter((place) => place !== user)
  const byLevel = await Promise.all(places.map((place) => readPlace(place, 'project')))
  const seen = new Set<string>()
  const skills: FoundSkill[] = []
  // The nearest folder's skill of a name is the one Claude Code loads.
  for (const s of byLevel.flat())
    if (!seen.has(s.name)) {
      seen.add(s.name)
      skills.push(s)
    }
  return skills
}

// Read only: nothing under these folders is ever written.
export async function listSkills(places: SkillPlaces): Promise<ListedSkills> {
  const user = resolve(places.user)
  const folders = [...new Set(places.folders)]
  const [userSkills, ...byFolder] = await Promise.all([
    readPlace(user, 'user'),
    ...folders.map((folder) => folderSkills(folder, user)),
  ])
  return {
    folders: Object.fromEntries(folders.map((folder, i) => [folder, byFolder[i] ?? []])),
    user: userSkills ?? [],
  }
}

// What a session started in `folder` can load (decision 1.157): its folder's chain and the user's.
export function foundFor(folder: string, listed: ListedSkills): readonly FoundSkill[] {
  return [...(listed.folders[folder] ?? []), ...listed.user]
}
