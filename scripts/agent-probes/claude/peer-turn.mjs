// What a resumed session sees of a plugin's skills when its first turn is a peer message (Menkar's
// team post) rather than a prompt: Claude Code adds no attachments to a peer turn's first request,
// so the skill is listed only after the first tool call, and the Skill tool must still find it by
// name. The same resume with a prompt on the command line lists the skill at once.
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { bytesOf, keep, makeRun, readJson, report, runClaude, startApi, text } from './lib.mjs'

const SKILL = 'probeplug:probe-skill'
// The skill's description: the post names the skill, so only this shows a listing.
const LISTED = 'A probe skill. Load it when told to.'
const SESSION = '66666666-aaaa-4bbb-8ccc-666666666666'

function plugin(dir) {
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true })
  writeFileSync(
    join(dir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'probeplug', version: '0.1.0', description: 'probe' }),
  )
  mkdirSync(join(dir, 'skills', 'probe-skill'), { recursive: true })
  writeFileSync(
    join(dir, 'skills', 'probe-skill', 'SKILL.md'),
    `---\nname: probe-skill\ndescription: ${LISTED}\n---\n\nSKILL-BODY-MARKER\n`,
  )
}

async function post(home, content) {
  const registry = join(home, '.claude', 'sessions')
  for (let tries = 0; tries < 100; tries += 1) {
    const entry = existsSync(registry)
      ? readdirSync(registry).find((f) => /^\d+\.json$/.test(f))
      : undefined
    if (entry !== undefined) {
      const { messagingSocketPath } = readJson(join(registry, entry))
      if (!messagingSocketPath.startsWith('/tmp/'))
        throw new Error(`refusing socket ${messagingSocketPath}`)
      const socket = connect(messagingSocketPath)
      const connected = await new Promise((done) => {
        socket.on('connect', () => done(true))
        socket.on('error', () => done(false))
      })
      if (connected) {
        const frame = { type: 'user', message: { content }, from: 'menkar', msg_id: 'm-peer-turn' }
        socket.end(`${JSON.stringify(frame)}\n`)
        return
      }
    }
    await sleep(100)
  }
  throw new Error('no messaging socket')
}

// `first` is 'post' (a [Menkar] frame to the socket once it is up) or 'prompt' (on the command line).
async function scenario(first) {
  const run = makeRun(`peer-turn-${first}`)
  const dir = join(run.dir, 'plugin')
  plugin(dir)
  let asked = false
  const api = await startApi((body) => {
    if (!body.tools) return text('t')
    const messages = JSON.stringify(body.messages ?? [])
    if (!asked && (messages.includes('PROBE-POST') || messages.includes('PROBE-PROMPT'))) {
      asked = true
      return {
        blocks: [{ type: 'tool_use', id: 'toolu_skill', name: 'Skill', input: { skill: SKILL } }],
        stop: 'tool_use',
      }
    }
    return text('PROBE-DONE')
  })
  await runClaude(run, api, ['--session-id', SESSION, 'PROBE-SEED'], { seconds: 8 })
  // The seed was killed, so its registry entry stays behind with a dead socket.
  const registry = join(run.home, '.claude', 'sessions')
  for (const name of existsSync(registry) ? readdirSync(registry) : []) rmSync(join(registry, name))
  const seeded = api.requests.length
  const args = ['--resume', SESSION]
  if (first === 'prompt') args.push(`PROBE-PROMPT load \`${SKILL}\``)
  args.push('--plugin-dir', dir)
  const running = runClaude(run, api, args, { seconds: 14 })
  if (first === 'post') await post(run.home, `[Menkar] PROBE-POST load \`${SKILL}\``)
  const reads = await running
  await api.close()
  keep(run, 'pty.raw', bytesOf(reads))
  const main = api.requests.slice(seeded).filter((r) => r.body.tools)
  const listed = (r) => JSON.stringify(r?.body.messages ?? []).includes(LISTED)
  const result = main
    .map((r) => JSON.stringify(r.body.messages ?? []))
    .find((m) => m.includes('"tool_use_id":"toolu_skill"'))
  return {
    run,
    firstListed: listed(main[0]),
    laterListed: main.slice(1).some(listed),
    launched: result?.includes(`Launching skill: ${SKILL}`) ?? false,
  }
}

const post_ = await scenario('post')
const prompt = await scenario('prompt')
report([
  {
    name: "a peer turn's first request does not list the plugin skill",
    ok: !post_.firstListed,
    detail: post_.run.dir,
  },
  {
    name: 'the Skill tool finds it by name all the same',
    ok: post_.launched,
    detail: post_.run.dir,
  },
  {
    name: 'it is listed after the first tool call',
    ok: post_.laterListed,
    detail: post_.run.dir,
  },
  {
    name: "a prompt turn's first request lists it",
    ok: prompt.firstListed && prompt.launched,
    detail: prompt.run.dir,
  },
])
