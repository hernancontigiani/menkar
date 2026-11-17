// How Menkar grants a session its files folder. `--add-dir` stopped every start at a trust dialog
// in 2.1.326; `permissions.additionalDirectories` in a `--settings` file is the route Menkar takes.
// The check records whether the dialog shows for each, and whether the folder still reaches the
// model as a working directory.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bytesOf, keep, makeRun, report, runClaude, startApi, text } from './lib.mjs'

const DIALOG = 'Adding a new directory'
const results = []

for (const route of ['add-dir', 'settings']) {
  const run = makeRun(`add-dir-${route}`)
  const files = join(run.dir, 'files')
  mkdirSync(files)
  const settings = join(run.dir, 'settings.json')
  writeFileSync(settings, JSON.stringify({ permissions: { additionalDirectories: [files] } }))
  const api = await startApi(() => text('PROBE-DONE'))
  const args =
    route === 'add-dir'
      ? ['PROBE-FILES', '--add-dir', files]
      : ['PROBE-FILES', '--settings', settings]
  const reads = await runClaude(run, api, args, { seconds: 15 })
  await api.close()
  const shown = bytesOf(reads)
    .toString('utf8')
    .replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g'), '')
    .replaceAll(' ', '')
  keep(run, 'pty.raw', bytesOf(reads))
  const dialog = shown.includes(DIALOG.replaceAll(' ', ''))
  const granted = api.requests.some((r) => JSON.stringify(r.body).includes(files))
  results.push({
    name: `${route}: dialog ${dialog ? 'shown' : 'not shown'}, folder ${granted ? 'granted' : 'not granted'}`,
    // Menkar relies on the settings route: no dialog, and the folder granted.
    ok: route === 'add-dir' || (!dialog && granted),
    detail: run.dir,
  })
}
report(results)
