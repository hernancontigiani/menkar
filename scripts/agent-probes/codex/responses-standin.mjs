// A stand-in for the OpenAI Responses API that the real `codex` TUI talks to instead of OpenAI, so
// a probe drives Codex with no login and no network. It answers from a script, records every request
// body, and writes nothing but its log folder, which must be under the system's temporary folder.
//
//   node scripts/agent-probes/codex/responses-standin.mjs --port 18800 --log <dir> [--script <file>]
//
// The script is JSON, re-read on every request so a probe can change it between turns:
//   { "rules": [{ "match": "<text in the turn's last user message>", "steps": [STEP, ...] }],
//     "default": "ok", "title": "Generated title", "titleDelayMs": 0, "usageTotal": 12 }
// STEP answers the request that follows the turn's user message (step 0) or its k-th tool output
// (step k), and is one of:
//   { "call": { "namespace": "mcp__menkar", "name": "task_review", "arguments": { ... } } }
//   { "exec": "<JavaScript for the code-mode exec tool>" }
//   { "shell": "<command for exec_command>" }
//   { "text": "<final reply>" }
// with optional "delayMs" (before any byte), "createdDelayMs" (after response.created) and
// "stream": { "chunks": 10, "intervalMs": 200 } (a text reply sent as deltas).
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const COMPACTION_PROMPT = 'You are performing a CONTEXT CHECKPOINT'

function readScript(file) {
  if (!file) return {}
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`stand-in: script ${file} unreadable, answering with defaults: ${error.message}`)
    return {}
  }
}

const textOf = (item) => (item.content ?? []).map((part) => part.text ?? '').join('')

// The title request is a structured-output request; a compaction's last user message is Codex's
// checkpoint prompt. Neither belongs to a scripted turn.
function classify(body) {
  const input = body.input ?? []
  let lastUser = -1
  input.forEach((item, i) => {
    if (item.type === 'message' && item.role === 'user') lastUser = i
  })
  const userText = lastUser >= 0 ? textOf(input[lastUser]) : ''
  const step = input.slice(lastUser + 1).filter((item) => /_output$/.test(item.type ?? '')).length
  const isTitle = body.text?.format?.type === 'json_schema'
  const isCompaction = userText.startsWith(COMPACTION_PROMPT)
  return { userText, step, isTitle, isCompaction }
}

function message(text) {
  return {
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_text', text, annotations: [] }],
  }
}

function answer(script, { userText, step, isTitle, isCompaction }, callId) {
  if (isTitle) {
    const title = script.title === undefined ? 'Generated title' : script.title
    return {
      kind: 'title',
      step: {},
      item: message(title === null ? '{}' : JSON.stringify({ title })),
    }
  }
  if (isCompaction) {
    return { kind: 'compaction', step: {}, item: message('Summary of the earlier conversation.') }
  }
  const rule = (script.rules ?? []).find((r) => userText.includes(r.match))
  const st = rule?.steps?.[step] ?? {}
  if (st.call) {
    const item = {
      type: 'function_call',
      call_id: callId,
      name: st.call.name,
      arguments: JSON.stringify(st.call.arguments ?? {}),
    }
    if (st.call.namespace) item.namespace = st.call.namespace
    const name = st.call.namespace ? `${st.call.namespace}.${st.call.name}` : st.call.name
    return { kind: `call ${name}`, step: st, item }
  }
  if (st.exec) {
    return {
      kind: 'exec',
      step: st,
      item: { type: 'custom_tool_call', call_id: callId, name: 'exec', input: st.exec },
    }
  }
  if (st.shell) {
    const item = {
      type: 'function_call',
      call_id: callId,
      name: 'exec_command',
      arguments: JSON.stringify({ cmd: st.shell }),
    }
    return { kind: 'shell', step: st, item }
  }
  return { kind: 'text', step: st, item: message(st.text ?? script.default ?? 'ok') }
}

function usage(total) {
  return {
    input_tokens: total - 2,
    output_tokens: 2,
    total_tokens: total,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  }
}

export function startStandin({ port, logDir, scriptFile }) {
  // Checked before the folder is created, then again once symlinks can be resolved.
  const tmp = realpathSync(tmpdir())
  const underTmp = (path) => path.startsWith(tmp + sep) || path.startsWith(tmpdir() + sep)
  if (!underTmp(resolve(logDir))) {
    throw new Error(`refusing: the log folder must be under ${tmp}, not ${resolve(logDir)}`)
  }
  mkdirSync(logDir, { recursive: true })
  const log = realpathSync(logDir)
  if (!log.startsWith(tmp + sep)) {
    throw new Error(`refusing: the log folder must be under ${tmp}, not ${log}`)
  }
  let n = readdirSync(log).filter((f) => /^\d+\.json$/.test(f)).length

  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', async () => {
      n += 1
      const id = String(n).padStart(3, '0')
      writeFileSync(join(log, `${id}.json`), raw)
      let body = {}
      try {
        body = JSON.parse(raw)
      } catch {
        console.error(`stand-in: request ${id} is not JSON; answering with the default text`)
      }
      const script = readScript(scriptFile)
      const seen = classify(body)
      const { kind, step, item } = answer(script, seen, `call_${id}`)
      item.id = `item_${id}`
      const summary = {
        n,
        at: new Date().toISOString(),
        model: body.model,
        kind,
        step: seen.step,
        user: seen.userText.slice(0, 120),
      }
      appendFileSync(join(log, 'requests.jsonl'), `${JSON.stringify(summary)}\n`)

      if (seen.isTitle && script.titleDelayMs) await sleep(script.titleDelayMs)
      if (step.delayMs) await sleep(step.delayMs)
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const send = (type, data) =>
        res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
      const responseId = `resp_${id}`
      send('response.created', { response: { id: responseId } })
      if (step.createdDelayMs) await sleep(step.createdDelayMs)
      if (step.stream && item.type === 'message') {
        const full = item.content[0].text
        const chunks = step.stream.chunks ?? 10
        send('response.output_item.added', {
          output_index: 0,
          item: { ...item, status: 'in_progress', content: [] },
        })
        send('response.content_part.added', {
          output_index: 0,
          item_id: item.id,
          content_index: 0,
          part: { type: 'output_text', text: '', annotations: [] },
        })
        for (let i = 0; i < chunks; i++) {
          const from = Math.floor((i * full.length) / chunks)
          const to = Math.floor(((i + 1) * full.length) / chunks)
          send('response.output_text.delta', {
            output_index: 0,
            item_id: item.id,
            content_index: 0,
            delta: full.slice(from, to),
          })
          await sleep(step.stream.intervalMs ?? 200)
        }
      }
      send('response.output_item.done', { output_index: 0, item })
      const total = seen.isTitle ? 12 : (script.usageTotal ?? 12)
      send('response.completed', { response: { id: responseId, usage: usage(total) } })
      res.end()
    })
  })
  server.listen(port, '127.0.0.1')
  return server
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : fallback
  }
  const logDir = option('log')
  if (!logDir) {
    console.error('usage: responses-standin.mjs --port <port> --log <dir> [--script <file>]')
    process.exit(2)
  }
  const port = Number(option('port', '18800'))
  const server = startStandin({ port, logDir: resolve(logDir), scriptFile: option('script') })
  server.on('listening', () => console.log(`stand-in on 127.0.0.1:${port}, log ${resolve(logDir)}`))
}
