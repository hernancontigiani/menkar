// The orchestrator's prompt hook, declared exactly as Menkar's settings write it and run by Menkar's
// own statusline program over an inbox file for pane p1: on each prompt the model must get the
// inbox's lines, the transcript must record them as the hook's additional context, and the screen
// must show nothing of them.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { bytesOf, keep, makeRun, REPO, report, runClaude, startApi, text } from './lib.mjs'

const LINES = ['The human took control of w1', 'w2 ended its turn without a report']
const run = makeRun('prompt-hook')
const cache = join(run.dir, 'cache')
const session = '55555555-aaaa-4bbb-8ccc-555555555555'

// The hook command comes from the source, so a change to it is what gets probed.
const require = createRequire(join(REPO, 'package.json'))
const { createServer } = require('vite')
const vite = await createServer({
  root: REPO,
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
})
process.env.XDG_CACHE_HOME = cache
let settings
let inbox
try {
  const { promptSubmitHooks } = await vite.ssrLoadModule('/src/core/context/settings.ts')
  const { inboxDir } = await vite.ssrLoadModule('/src/core/context/statusline.ts')
  inbox = inboxDir()
  const program = join(REPO, 'src/core/context/statusline.ts')
  settings = { hooks: promptSubmitHooks(`'${process.execPath}' '${program}'`) }
} finally {
  await vite.close()
}
if (!inbox.startsWith(run.dir)) throw new Error(`refusing inbox ${inbox}`)
mkdirSync(inbox, { recursive: true })
const entries = LINES.map((line, i) => ({ seq: i + 1, at: Date.now() + i, text: line }))
writeFileSync(join(inbox, 'p1.json'), JSON.stringify({ session_id: session, dropped: 0, entries }))
const settingsFile = join(run.dir, 'settings.json')
writeFileSync(settingsFile, JSON.stringify(settings))

const api = await startApi(() => text('PROBE-DONE'))
const reads = await runClaude(
  run,
  api,
  ['--settings', settingsFile, '--session-id', session, 'PROBE-FIRST'],
  {
    seconds: 20,
    keys: [
      [10, 'PROBE-SECOND'],
      [10.6, '\r'],
    ],
    extraEnv: { MENKAR_PANE: 'p1', XDG_CACHE_HOME: cache },
  },
)
await api.close()
keep(run, 'pty.raw', bytesOf(reads))

const records = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name.endsWith('.jsonl'))
      for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean))
        records.push(JSON.parse(line))
  }
}
walk(join(run.home, '.claude', 'projects'))
const given = (value) => LINES.every((line) => JSON.stringify(value).includes(line))
const prompts = ['PROBE-FIRST', 'PROBE-SECOND']
// The main request of each prompt: the one with tools whose last user message holds that prompt.
const seen = prompts.filter((prompt) =>
  api.requests.some((r) => {
    const messages = r.body.messages ?? []
    return r.body.tools && JSON.stringify(messages).includes(prompt) && given(messages.at(-1))
  }),
)
const recorded = records.filter(
  (r) => r.type === 'attachment' && r.attachment?.type === 'hook_additional_context' && given(r),
).length
const screen = bytesOf(reads).toString('utf8')
report([
  {
    name: 'the model gets the inbox on each prompt',
    ok: seen.length === prompts.length,
    detail: `${seen.length}/${prompts.length} prompts (${run.dir})`,
  },
  {
    name: 'the transcript records it as hook_additional_context',
    ok: recorded === prompts.length,
    detail: `${recorded} records (${run.dir})`,
  },
  {
    name: 'the screen shows nothing of it',
    ok: !LINES.some((line) => screen.includes(line)),
    detail: run.dir,
  },
])
