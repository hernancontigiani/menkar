#!/usr/bin/env node
// The `claude` a capture runs, never the real one: it draws the screen the seed wrote for its
// session, sets the terminal title as Claude Code does, and waits. It contacts nothing.
//
// The app reads Claude Code's state from the title and the screen's last lines: a title starting
// with a Braille spinner is working (TITLE_WORKING, src/core/agents/claude/state.ts:9), "✳ " is
// idle, and "Do you want to proceed?" near the bottom is blocked (detect(), same file). Those
// words are Claude Code's own and stay English in every locale; the conversation is the seed's.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
if (args[0] === '--version') {
  process.stdout.write('2.1.329 (Claude Code)\n')
  process.exit(0)
}

const after = (flag) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args[at + 1] : undefined
}
const id = after('--resume') ?? after('--session-id') ?? 'default'
const dir = process.env.MENKAR_STAND_IN_SCREENS ?? ''

function load(name) {
  try {
    return JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
const screen = load(id) ?? load('default') ?? { title: '', state: 'idle', prompt: '', lines: [] }

const TITLE = { working: '⠋', blocked: '✳', idle: '✳' }
const bold = (s) => `\x1b[1m${s}\x1b[22m`
const dim = (s) => `\x1b[2m${s}\x1b[22m`
const accent = (s) => `\x1b[38;5;173m${s}\x1b[39m`

function draw() {
  const out = [`\x1b]0;${TITLE[screen.state]} ${screen.title}\x07`, '\x1b[2J\x1b[H']
  const line = (s = '') => out.push(`${s}\r\n`)
  if (screen.prompt) {
    line(bold(`> ${screen.prompt}`))
    line()
  }
  for (const text of screen.lines) {
    line(`${accent('●')} ${text}`)
    line()
  }
  if (screen.state === 'blocked') {
    line(bold(' Bash command'))
    line(`   ${screen.ask ?? ''}`)
    line()
    line(' Do you want to proceed?')
    line(` ${accent('❯')} 1. Yes`)
    line('   2. No')
  } else if (screen.state === 'working') {
    line(`${accent('✻')} ${dim('Working… (esc to interrupt)')}`)
  } else {
    line(dim('─'.repeat(Math.max(10, Math.min(process.stdout.columns ?? 80, 120) - 2))))
    out.push('> ')
  }
  process.stdout.write(out.join(''))
}

draw()
process.stdout.on('resize', draw)
if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.resume()
for (const signal of ['SIGHUP', 'SIGTERM']) process.on(signal, () => process.exit(0))
