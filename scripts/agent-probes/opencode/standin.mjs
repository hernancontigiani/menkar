// A stand-in OpenAI-compatible chat model on 127.0.0.1, so the real `opencode` runs with no login
// and no network. It logs every request body, one JSON line each, and answers by keywords in the
// last user message:
//   CALL:<tool> <json>   call that tool with those arguments
//   RUNTOOL              call `shell` with `touch b.txt` (a permission card)
//   ASKQ                 call `question` (a question card)
//   SUBAGENT             call `subagent` with a child that takes 4 s
//   SLOW                 wait 20 s before answering
// and fills in OpenCode's compaction template. Every answer reports 1,000 prompt tokens, 300 of
// them cached, and 10 completion tokens.
import fs from 'node:fs'
import http from 'node:http'

const [port, logFile] = [Number(process.argv[2]), process.argv[3]]
let n = 0
const textOf = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text ?? '').join('') : ''
const SUMMARY = [
  '## Objective',
  '- probe',
  '## Requirements',
  '- (none)',
  '## Decisions',
  '- (none)',
  '## Work State',
  '### Completed',
  '- (none)',
  '### Active',
  '- probe',
  '### Blocked',
  '- (none)',
  '## Next Move',
  '1. (none)',
  '## Relevant Files',
  '- (none)',
  '## Important Context',
  '- (none)',
].join('\n\n')
const QUESTION = {
  questions: [
    {
      question: 'Which one?',
      header: 'Pick',
      options: [
        { label: 'Alpha', description: 'the first' },
        { label: 'Beta', description: 'the second' },
      ],
    },
  ],
}

function answer(messages) {
  const last = messages[messages.length - 1] ?? {}
  const user = textOf([...messages].reverse().find((m) => m.role === 'user')?.content)
  const call = /CALL:(\S+)\s*(\{.*\})?/s.exec(user)
  if (/MUST summarize|did not fill in/.test(user)) return { text: SUMMARY }
  if (last.role === 'tool') return { text: `tool done ${n}` }
  if (call) return { tool: call[1], args: call[2] ? JSON.parse(call[2]) : {} }
  if (user.includes('ASKQ')) return { tool: 'question', args: QUESTION }
  if (user.includes('RUNTOOL'))
    return { tool: 'shell', args: { command: 'touch b.txt', description: 'touch b' } }
  if (user.includes('SUBAGENT'))
    return {
      tool: 'subagent',
      args: { agent: 'general', description: 'probe child', prompt: 'child work CHILDSLOW' },
    }
  return { text: `ack ${n}: ${user.slice(-60).replace(/\s+/g, ' ')}` }
}

http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (d) => {
      body += d
    })
    req.on('end', async () => {
      n++
      const b = body ? JSON.parse(body) : {}
      fs.appendFileSync(
        logFile,
        `${JSON.stringify({ id: n, t: Date.now(), url: req.url, body: b })}\n`,
      )
      if (req.url.endsWith('/models')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 'm1', object: 'model' }] }))
        return
      }
      const messages = b.messages ?? []
      const last = messages[messages.length - 1] ?? {}
      const user = textOf([...messages].reverse().find((m) => m.role === 'user')?.content)
      const reply = answer(messages)
      const slow = user.includes('SLOW') && last.role !== 'tool'
      const delay = slow ? (user.includes('CHILDSLOW') ? 4000 : 20000) : 800
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const send = (o) =>
        res.write(
          `data: ${JSON.stringify({ id: `c${n}`, object: 'chat.completion.chunk', created: 0, model: 'm1', ...o })}\n\n`,
        )
      send({ choices: [{ index: 0, delta: { role: 'assistant' } }] })
      await new Promise((r) => setTimeout(r, delay))
      if (reply.tool) {
        const call = { name: reply.tool, arguments: JSON.stringify(reply.args) }
        send({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index: 0, id: `call_${n}`, type: 'function', function: call }],
              },
            },
          ],
        })
        send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
      } else {
        send({ choices: [{ index: 0, delta: { content: reply.text } }] })
        send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
      }
      send({
        choices: [],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 10,
          total_tokens: 1010,
          prompt_tokens_details: { cached_tokens: 300 },
        },
      })
      res.write('data: [DONE]\n\n')
      res.end()
    })
  })
  .listen(port, '127.0.0.1')
