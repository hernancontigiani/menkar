import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SESSION = '5c1e7a2b-0f3d-4e6a-8b9c-1d2e3f4a5b6c'

// A stand-in `claude` (never the real one): it records its arguments, writes the transcript a
// new session or a fork would get, with one typed message, and stays in the foreground until
// it reads EXIT0 or EXIT1; ASK makes it print a permission question.
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path')
const args = process.argv.slice(2)
fs.appendFileSync(path.join(process.env.HOME, 'claude-args.txt'), args.join(' ') + '\\n')
fs.writeFileSync(path.join(process.env.HOME, 'claude-pid.txt'), String(process.pid))
const at = args.indexOf('--session-id')
if (at >= 0 && !process.env.FAKE_CLAUDE_QUIET) {
  const id = args[at + 1]
  const name = args.includes('-n') ? args[args.indexOf('-n') + 1] : null
  const folder = path.join(process.env.HOME, '.claude', 'projects', process.cwd().replace(/[^A-Za-z0-9]/g, '-'))
  fs.mkdirSync(folder, { recursive: true })
  const lines = []
  if (name) lines.push({ type: 'custom-title', customTitle: name })
  lines.push({ type: 'user', cwd: process.cwd(), message: { content: 'typed in the stand-in' } })
  fs.writeFileSync(path.join(folder, id + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\\n') + '\\n')
}
process.stdout.write('stand-in claude ready\\r\\n')
// Raw, so the bytes each key sends arrive as they are; recorded as hex, one read per line.
if (process.stdin.isTTY) process.stdin.setRawMode(true)
let typed = ''
process.stdin.on('data', (d) => {
  fs.appendFileSync(path.join(process.env.HOME, 'claude-input.txt'), d.toString('hex') + '\\n')
  typed += d.toString()
  if (typed.includes('EXIT0')) process.exit(0)
  if (typed.endsWith('ASK')) process.stdout.write('Do you want to proceed?\\r\\n')
  if (typed.includes('EXIT1')) {
    process.stderr.write('stand-in failed to start\\r\\n')
    process.exit(1)
  }
})
`

// The colours these tests assert are Catppuccin's, as the old "Default" theme gave them: Mocha
// unless the scheme is light, with the terminals in the theme's colours too. A test about the
// first start's own theme or terminal colours writes neither.
export function catppuccin(scheme: unknown): string {
  return scheme === 'light' ? 'Catppuccin Latte' : 'Catppuccin Mocha'
}

export function prepare(dirs: {
  readonly root: string
  readonly home: string
}): Record<string, string> {
  const bin = join(dirs.root, 'bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, 'claude'), FAKE_CLAUDE)
  chmodSync(join(bin, 'claude'), 0o755)
  const work = join(dirs.home, 'work')
  mkdirSync(work, { recursive: true })
  const transcripts = join(dirs.home, '.claude', 'projects', work.replace(/[^A-Za-z0-9]/g, '-'))
  mkdirSync(transcripts, { recursive: true })
  writeFileSync(
    join(transcripts, `${SESSION}.jsonl`),
    `${JSON.stringify({ type: 'user', cwd: work, message: { content: 'fix the login bug' } })}\n`,
  )
  const config = join(dirs.root, 'config', 'menkar')
  mkdirSync(config, { recursive: true })
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: 'aaaaaaaaaaaa',
      projects: [{ id: 'aaaaaaaaaaaa', name: 'Client work', members: [SESSION], groups: [] }],
      windows: [],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: 'dark',
        terminal_theme: catppuccin('dark'),
        terminal_colors: 'theme',
      },
    }),
  )
  return { PATH: `${bin}:${process.env.PATH ?? ''}` }
}

// The look's standard case: "Client work" with a group "api pair" (#5ec4b6) of two sessions and
// one session in no group, in two folders. `tabs` lists saved tabs by session key.
export const CLIENT = {
  login: '1a1a1a1a-0000-4000-8000-000000000001',
  api: '2b2b2b2b-0000-4000-8000-000000000002',
  long: '3c3c3c3c-0000-4000-8000-000000000003',
} as const
export const CLIENT_NAMES = {
  login: 'login fix',
  api: 'api review',
  long: 'abcdefghijklmnopqrstuvwxyz0123456789ABCD',
} as const
export type ClientKey = keyof typeof CLIENT

export function clientWork(
  dirs: { readonly root: string; readonly home: string },
  options: {
    readonly settings?: Readonly<Record<string, unknown>>
    readonly tabs?: readonly (readonly ClientKey[])[]
    readonly extraProjects?: readonly { id: string; name: string; members: string[] }[]
  } = {},
): Record<string, string> {
  const env = prepare(dirs)
  const folders: Record<ClientKey, string> = {
    login: join(dirs.home, 'work', 'api'),
    api: join(dirs.home, 'work', 'api'),
    long: join(dirs.home, 'work', 'web'),
  }
  for (const key of Object.keys(CLIENT) as ClientKey[]) {
    const cwd = folders[key]
    mkdirSync(cwd, { recursive: true })
    const transcripts = join(dirs.home, '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
    mkdirSync(transcripts, { recursive: true })
    writeFileSync(
      join(transcripts, `${CLIENT[key]}.jsonl`),
      `${[
        { type: 'custom-title', customTitle: CLIENT_NAMES[key] },
        { type: 'user', cwd, message: { content: `work on ${key}` } },
      ]
        .map((l) => JSON.stringify(l))
        .join('\n')}\n`,
    )
  }
  const config = join(dirs.root, 'config', 'menkar')
  const project = 'cccccccccccc'
  writeFileSync(
    join(config, 'projects.json'),
    JSON.stringify({
      version: 1,
      current: project,
      projects: [
        {
          id: project,
          name: 'Client work',
          members: [CLIENT.login, CLIENT.api, CLIENT.long],
          groups: [{ name: 'api pair', color: '#5ec4b6', members: [CLIENT.login, CLIENT.api] }],
        },
        ...(options.extraProjects ?? []).map((p) => ({ ...p, groups: [] })),
      ],
      windows:
        options.tabs === undefined
          ? []
          : [
              {
                current: project,
                tabs: {
                  [project]: options.tabs.map((keys) => ({
                    panes: keys.map((k) => CLIENT[k]),
                    orientation: 'horizontal',
                  })),
                },
              },
            ],
    }),
  )
  writeFileSync(
    join(config, 'state.json'),
    JSON.stringify({
      settings: {
        color_scheme: 'dark',
        terminal_theme: catppuccin(options.settings?.color_scheme),
        terminal_colors: 'theme',
        ...options.settings,
      },
    }),
  )
  return env
}
