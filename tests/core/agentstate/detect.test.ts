// Claude Code's and Cursor's state rules (docs/spec/agent-state.md, AST-1 to AST-16).
import { describe, expect, test } from 'vitest'
import { detectState } from '../../../src/core/agentstate/detect'

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
