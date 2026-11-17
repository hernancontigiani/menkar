// Does Menkar read Claude Code's permission cards as blocked? The stand-in API asks for a Bash
// `git push`; in manual mode that raises the usual card, and in auto mode, with the classifier
// answering "block" three times, auto mode's confirmation card. Each screen is judged by main's
// detectState at the end of each burst.
import { bytesOf, judge, keep, makeRun, report, runClaude, startApi, text } from './lib.mjs'

const push = {
  blocks: [
    {
      type: 'tool_use',
      id: 'toolu_probe',
      name: 'Bash',
      input: { command: 'git push origin main', description: 'Push the branch' },
    },
  ],
  stop: 'tool_use',
}

// The classifier's requests stop on `</severity>`; 80 is past its allow/block line of 50.
function answer(body) {
  if (body.stop_sequences?.includes('</severity>')) return text('<severity>80')
  const asked = JSON.stringify(body.messages ?? [])
  const results = asked.split('tool_result').length - 1
  if (asked.includes('PROBE-PUSH') && results < 3 && body.tools?.some((t) => t.name === 'Bash')) {
    return push
  }
  return text('PROBE-DONE')
}

const results = []
for (const [mode, card] of [
  ['manual', 'This command requires approval'],
  ['auto', 'Auto mode needs your confirmation'],
]) {
  const run = makeRun(`permission-${mode}`)
  const api = await startApi(answer)
  // In auto mode a stand-in gateway first gets a notice about classifier billing; Enter dismisses it.
  const keys = mode === 'auto' ? [[8, '\r']] : []
  const reads = await runClaude(run, api, ['PROBE-PUSH please', '--permission-mode', mode], {
    seconds: 30,
    keys,
  })
  await api.close()
  keep(run, 'pty.raw', bytesOf(reads))
  const verdicts = await judge(reads)
  const onCard = verdicts.filter((v) => v.screen.includes(card))
  const misread = onCard.filter((v) => v.state !== 'blocked')
  if (onCard.length > 0) keep(run, 'card.txt', onCard[onCard.length - 1].screen)
  results.push({
    name: `${mode} card read as blocked`,
    ok: onCard.length > 0 && misread.length === 0,
    detail:
      onCard.length === 0
        ? `the card never showed (${run.dir})`
        : `${onCard.length - misread.length}/${onCard.length} bursts blocked (${run.dir})`,
  })
}
report(results)
