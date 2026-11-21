// Does Menkar read Claude Code's permission cards as blocked? The stand-in API asks for a tool call
// that raises a card, and each screen is judged by main's detectState at the end of each burst:
// - manual mode, a Bash `git push`: the usual card;
// - auto mode, the same push with the classifier answering "block" three times: auto mode's
//   confirmation card;
// - auto mode through a stand-in gateway, the same push with the notice about classifier billing
//   left unanswered: the notice stops the session until Enter or Esc;
// - auto mode, a Read of a file outside the working directories with the classifier allowing it:
//   the one-time card that asks about reads outside the working directories.
import { bytesOf, judge, keep, makeRun, report, runClaude, startApi, text } from './lib.mjs'

const call = (name, input) => ({
  blocks: [{ type: 'tool_use', id: 'toolu_probe', name, input }],
  stop: 'tool_use',
})

// The classifier's requests stop on `</severity>`; its allow/block line is 50.
function answerWith({ severity, tool, input }) {
  return (body) => {
    if (body.stop_sequences?.includes('</severity>')) return text(`<severity>${severity}`)
    const asked = JSON.stringify(body.messages ?? [])
    const results = asked.split('tool_result').length - 1
    if (asked.includes('PROBE-CALL') && results < 3 && body.tools?.some((t) => t.name === tool)) {
      return call(tool, input)
    }
    return text('PROBE-DONE')
  }
}

const push = {
  tool: 'Bash',
  input: { command: 'git push origin main', description: 'Push the branch' },
}
const SCENARIOS = [
  { name: 'manual', mode: 'manual', card: 'This command requires approval', severity: 80, ...push },
  {
    name: 'auto-block',
    mode: 'auto',
    card: 'Auto mode needs your confirmation',
    severity: 80,
    ...push,
  },
  {
    // The notice itself, left unanswered: it stops the session until Enter or Esc.
    name: 'auto-billing-notice',
    mode: 'auto',
    card: "We're changing auto mode",
    severity: 80,
    keys: [],
    ...push,
  },
  {
    name: 'auto-read-outside',
    mode: 'auto',
    card: 'Allow this read outside the working directories?',
    severity: 10,
    tool: 'Read',
    input: { file_path: '/etc/hostname' },
  },
]

const results = []
for (const scenario of SCENARIOS) {
  const run = makeRun(`permission-${scenario.name}`)
  const api = await startApi(answerWith(scenario))
  // In auto mode a stand-in gateway first gets a notice about classifier billing; Enter dismisses it.
  const keys = scenario.keys ?? (scenario.mode === 'auto' ? [[8, '\r']] : [])
  const reads = await runClaude(
    run,
    api,
    ['PROBE-CALL please', '--permission-mode', scenario.mode],
    {
      seconds: 30,
      keys,
    },
  )
  await api.close()
  keep(run, 'pty.raw', bytesOf(reads))
  const verdicts = await judge(reads)
  const onCard = verdicts.filter((v) => v.screen.includes(scenario.card))
  const misread = onCard.filter((v) => v.state !== 'blocked')
  if (onCard.length > 0) {
    const last = onCard[onCard.length - 1]
    keep(run, 'card.txt', last.screen)
    keep(run, 'title.txt', last.title)
  }
  results.push({
    name: `${scenario.name} card read as blocked`,
    ok: onCard.length > 0 && misread.length === 0,
    detail:
      onCard.length === 0
        ? `the card never showed (${run.dir})`
        : `${onCard.length - misread.length}/${onCard.length} bursts blocked (${run.dir})`,
  })
}
report(results)
