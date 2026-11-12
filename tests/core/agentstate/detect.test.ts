// Claude Code's and Cursor's state rules (docs/spec/agent-state.md, AST-1 to AST-16).
import { describe, expect, test } from 'vitest'
import { detectState } from '../../../src/core/agentstate/detect'
import { nextShown } from '../../../src/core/agentstate/shown'

const screen = (...lines: string[]) => lines.join('\n')

describe("Claude Code's rules", () => {
  test('AST-1 a Braille spinner and a space in the title is working', () => {
    expect(detectState('claude', '⠋ Fixing tests', screen('> fix the tests', ''))).toBe('working')
  })

  test("AST-2 the half-circle spinner is working; Claude's idle title is idle", () => {
    expect(detectState('claude', '◐ Thinking', '')).toBe('working')
    expect(detectState('claude', '✳ Ready', screen('> ', ''))).toBe('idle')
  })

  test('AST-3 a spinner with no space after it is not working', () => {
    expect(detectState('claude', '⠋Fixing', 'all good')).toBe('idle')
  })

  test('AST-4 "esc to interrupt" on screen is working whatever the title', () => {
    expect(detectState('claude', '✳ x', screen('reading files', '  (esc to interrupt)'))).toBe(
      'working',
    )
  })

  test('AST-5 a permission question is blocked whatever the title', () => {
    const question = screen('Bash command', 'Do you want to proceed?', '❯ 1. Yes', '  2. No')
    expect(detectState('claude', '⠋ Working', question)).toBe('blocked')
    expect(detectState('claude', '✳ x', question)).toBe('blocked')
  })

  test('AST-6 the /model picker is idle, not a question', () => {
    const picker = screen('Select model', '❯ 1. Opus', 'Enter to set as default', 'Esc to cancel')
    expect(detectState('claude', '✳ x', picker)).toBe('idle')
  })

  test('AST-7 "esc to cancel" with "enter to select" is blocked', () => {
    expect(
      detectState('claude', '✳ x', screen('Pick one', 'Esc to cancel · Enter to select')),
    ).toBe('blocked')
    expect(detectState('claude', '✳ x', screen('Esc to cancel', 'Enter to confirm'))).toBe(
      'blocked',
    )
  })

  test('AST-8 "would you like to" with a yes is blocked', () => {
    expect(detectState('claude', '✳ x', 'Would you like to continue? Yes / No')).toBe('blocked')
    expect(detectState('claude', '✳ x', 'Do you want to see the eyes?')).toBe('blocked')
  })

  test('AST-9 only the last 14 non-empty lines count, however many blank lines', () => {
    const lines = ['Do you want to proceed?']
    for (let i = 0; i < 13; i += 1) lines.push(`line ${i}`, '', '   ')
    lines.push('Esc to interrupt')
    expect(detectState('claude', '✳ x', screen(...lines))).toBe('working')
    lines.splice(1, 3) // one non-empty line fewer: the question is the 14th from the bottom
    expect(detectState('claude', '✳ x', screen(...lines))).toBe('blocked')
  })

  // Decision 1.105: a background task still running is working, from the pill in Claude Code's
  // footer. Its texts were read in Claude Code 2.1.323's program, not seen drawn yet.
  const box = ['─'.repeat(40), '> ', '─'.repeat(40)]
  const idleWith = (footer: string) => screen('● Done.', '', ...box, footer)

  test.each([
    '  ⏵⏵ auto mode on (shift+tab to cycle) · 1 shell · ↓ to manage',
    '  3 shells · ↓ to manage',
    '  1 shell, 2 monitors',
    '  1 monitor',
    '  1 Artifact comment monitor',
    '  2 local agents',
    '  1 local agent',
    '  1 team',
    '  1 MCP task',
    '  ↳ 2 background',
    '  2 background tasks',
    '  3 background dynamic workflows',
    '  ◇ 1 cloud session',
    '  ◇ 2 remote dynamic workflows',
    '  ⏵⏵ auto mode on · 1 shell', // too narrow for "↓ to manage"
  ])('decision 1.105: the footer pill "%s" while idle is working', (footer) => {
    expect(detectState('claude', '✳ x', idleWith(footer))).toBe('working')
  })

  test.each([
    '  ? for shortcuts',
    '  saving memories',
    '  dreaming',
    '  auto-mode scan',
    '  memory import 2/5',
    '  0 shells',
  ])('decision 1.105: "%s" in the footer is not background work', (footer) => {
    expect(detectState('claude', '✳ x', idleWith(footer))).toBe('idle')
  })

  test('decision 1.105: a pill named in the conversation or typed in the box is not the footer', () => {
    const above = screen(
      'I started 2 shells for the tests:',
      '  2 shells',
      ...box,
      '  ? for shortcuts',
    )
    expect(detectState('claude', '✳ x', above)).toBe('idle')
    const typed = screen(
      '● Done.',
      '─'.repeat(40),
      '> 2 shells',
      '─'.repeat(40),
      '  ? for shortcuts',
    )
    expect(detectState('claude', '✳ x', typed)).toBe('idle')
  })

  // Captured from Claude Code 2.1.323 in tmux, idle after a turn, two shells in the background and
  // a one-line statusline like Menkar's: the pill is on the last line, under the statusline.
  const captured = (footer: string) =>
    screen(
      '✻ Cogitated for 3s · done 8:47 PM · 2 shells still running',
      '',
      `${'─'.repeat(40)} footer-probe ─`,
      '❯ ',
      '─'.repeat(56),
      '  probe · 22% · $1.20',
      footer,
    )

  test("decision 1.105: Claude Code's real footer with two shells running is working", () => {
    expect(detectState('claude', '✳ x', captured('  ⏵⏵ auto mode on · 2 shells'))).toBe('working')
  })

  test('decision 1.105: the turn summary naming shells still running, with no pill below, is idle', () => {
    expect(detectState('claude', '✳ x', captured('  ⏵⏵ auto mode on'))).toBe('idle')
  })

  test("decision 1.105: the pill counts only in the last 3 non-empty lines, the footer's", () => {
    expect(detectState('claude', '✳ x', screen('  1 shell', '', 'a', '  ', 'b'))).toBe('working')
    expect(detectState('claude', '✳ x', screen('  1 shell', 'a', 'b', 'c'))).toBe('idle')
  })

  test('decision 1.105: a permission question with the pill in the footer is blocked', () => {
    const question = screen('Do you want to proceed?', '❯ 1. Yes', '  2. No', '  1 shell')
    expect(detectState('claude', '✳ x', question)).toBe('blocked')
  })

  test('decision 1.105: unseen, the turn ends with a shell still running: working until it ends, then done', () => {
    let state = nextShown('working', detectState('claude', '✳ x', idleWith('  1 shell')), false)
    expect(state).toBe('working')
    state = nextShown(state, detectState('claude', '✳ x', idleWith('  ? for shortcuts')), false)
    expect(state).toBe('done')
  })

  test('AST-10 other permission prompts are blocked', () => {
    for (const text of [
      'Review your answers',
      'Waiting for permission…',
      'Do you want to allow this connection?',
    ]) {
      expect(detectState('claude', '✳ x', text)).toBe('blocked')
    }
  })
})

describe("Cursor's rules", () => {
  test('AST-11 "run this command?" with its choices is blocked', () => {
    expect(
      detectState('cursor', '', screen('Run this command?', 'npm test', 'Run (once) (y)')),
    ).toBe('blocked')
  })

  test('AST-12 an allow or run line ending in (y) is blocked', () => {
    expect(detectState('cursor', '', '  → Allow write to src/a.ts (y)')).toBe('blocked')
    expect(detectState('cursor', '', 'Run npm test (y)')).toBe('blocked')
    expect(detectState('cursor', '', 'running npm test (y)')).toBe('idle')
  })

  test('AST-13 keep and proceed prompts are blocked', () => {
    expect(detectState('cursor', '', 'Keep (n)')).toBe('blocked')
    expect(detectState('cursor', '', screen('Write to this file?', 'Proceed (y)'))).toBe('blocked')
  })

  test('AST-14 a Braille spinner before an -ing word is working', () => {
    expect(detectState('cursor', '', '⠙ Generating')).toBe('working')
    expect(detectState('cursor', '', '  ⠙⠹ reading files')).toBe('working')
    expect(detectState('cursor', '', '⠙ Generated')).toBe('idle')
  })

  test('AST-15 "ctrl+c to stop" counts only in the last 6 non-empty lines', () => {
    const lines = ['ctrl+c to stop', 'a', 'b', 'c', 'd', 'e']
    expect(detectState('cursor', '', screen(...lines))).toBe('working')
    expect(detectState('cursor', '', screen(...lines, 'f'))).toBe('idle')
  })

  test('AST-16 one or more background tasks is working; zero is not', () => {
    expect(detectState('cursor', '', '3 background tasks')).toBe('working')
    expect(detectState('cursor', '', '0 background tasks')).toBe('idle')
    expect(detectState('cursor', '', '12 background task')).toBe('working')
    expect(detectState('cursor', '', '012 background tasks')).toBe('idle')
  })

  test("Cursor's prompts count only in the last 10 non-empty lines", () => {
    const lines = ['Keep (n)', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    expect(detectState('cursor', '', screen(...lines))).toBe('blocked')
    expect(detectState('cursor', '', screen(...lines, '10'))).toBe('idle')
  })

  test("Cursor's title is not read", () => {
    expect(detectState('cursor', '⠋ Busy', '')).toBe('idle')
  })
})

test('an agent other than Claude Code and Cursor is always idle', () => {
  expect(detectState('gemini', '⠋ Busy', 'Do you want to proceed? yes')).toBe('idle')
})
