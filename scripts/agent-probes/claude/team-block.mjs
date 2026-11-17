// The team block Menkar passes with `--append-system-prompt-file`: it must be in the system prompt
// of the very first request, and a missing file must stop Claude Code before any request.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bytesOf, keep, makeRun, report, runClaude, startApi, text } from './lib.mjs'

const MARKER = 'PROBE-TEAM-BLOCK'
const systemOf = (body) =>
  Array.isArray(body.system)
    ? body.system.map((s) => s.text ?? '').join('\n')
    : String(body.system ?? '')
const results = []

{
  const run = makeRun('team-block')
  const file = join(run.dir, 'team.md')
  writeFileSync(
    file,
    `${Array.from({ length: 25 }, (_, i) => `${MARKER} line ${i + 1}`).join('\n')}\n`,
  )
  const api = await startApi(() => text('PROBE-DONE'))
  const reads = await runClaude(run, api, ['PROBE-FIRST', '--append-system-prompt-file', file], {
    seconds: 15,
  })
  await api.close()
  keep(run, 'pty.raw', bytesOf(reads))
  // The main conversation's request carries the tools; a side request (a title) may carry the prompt.
  const first = api.requests.find(
    (r) =>
      (r.body.tools?.length ?? 0) > 0 &&
      JSON.stringify(r.body.messages ?? []).includes('PROBE-FIRST'),
  )
  results.push({
    name: 'block in the first request',
    ok: first !== undefined && systemOf(first.body).includes(MARKER),
    detail: run.dir,
  })
}

{
  const run = makeRun('team-block-missing')
  const api = await startApi(() => text('PROBE-DONE'))
  const reads = await runClaude(
    run,
    api,
    ['PROBE-FIRST', '--append-system-prompt-file', join(run.dir, 'absent.md')],
    { seconds: 8 },
  )
  await api.close()
  const shown = bytesOf(reads).toString('utf8')
  results.push({
    name: 'missing file stops before any request',
    ok: !api.requests.some((r) => r.path.startsWith('/v1/messages')) && shown.includes('not found'),
    detail: run.dir,
  })
}
report(results)
