// a prompt_file is read in main, only an absolute path to a regular file of
// at most 100 KiB of UTF-8 text; its copy is what the command line reads.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  PROMPT_KEEP_MS,
  PROMPT_MAX_BYTES,
  readPromptFile,
  savePrompt,
  sweepPrompts,
} from '../../../src/core/control/prompt'

const dir = mkdtempSync(join(tmpdir(), 'menkar-prompt-'))

describe('a prompt file', () => {
  test('a file under the limit is read whole', async () => {
    const file = join(dir, 'ok.md')
    writeFileSync(file, 'Build plan 31, block 1. ñandú\n')
    expect(await readPromptFile(file)).toEqual({ text: 'Build plan 31, block 1. ñandú\n' })
    writeFileSync(join(dir, 'max.md'), 'x'.repeat(PROMPT_MAX_BYTES))
    expect(await readPromptFile(join(dir, 'max.md'))).toHaveProperty('text')
  })

  test.each([
    ['a relative path', () => 'prompts/a.md'],
    ['a folder', () => (mkdirSync(join(dir, 'folder'), { recursive: true }), join(dir, 'folder'))],
    ['a missing file', () => join(dir, 'missing.md')],
    [
      '100 KiB + 1',
      () => (
        writeFileSync(join(dir, 'big.md'), 'x'.repeat(PROMPT_MAX_BYTES + 1)), join(dir, 'big.md')
      ),
    ],
    ['NUL bytes', () => (writeFileSync(join(dir, 'nul.md'), 'a\0b'), join(dir, 'nul.md'))],
    [
      'bytes that are not UTF-8',
      () => (
        writeFileSync(join(dir, 'latin.md'), Buffer.from([0x61, 0xe9, 0x62])), join(dir, 'latin.md')
      ),
    ],
  ])('%s is refused with a sentence', async (_, make) => {
    const answer = await readPromptFile(make())
    expect(answer).toHaveProperty('refusal')
    expect((answer as { refusal: string }).refusal).toMatch(/^[A-Z].*\.$/)
  })

  test('the copy the command reads holds the text as given', async () => {
    const path = await savePrompt('req-1', 'line one\n"$(rm -rf ~)"\n')
    expect(path.endsWith(join('control', 'prompts', 'req-1.md'))).toBe(true)
    expect(readFileSync(path, 'utf8')).toBe('line one\n"$(rm -rf ~)"\n')
  })

  test('a copy older than a day is deleted; a younger one stays', async () => {
    const old = await savePrompt('old', 'a')
    const young = await savePrompt('young', 'b')
    const now = 2_000_000_000_000
    utimesSync(old, (now - PROMPT_KEEP_MS - 1000) / 1000, (now - PROMPT_KEEP_MS - 1000) / 1000)
    utimesSync(young, (now - 1000) / 1000, (now - 1000) / 1000)
    await sweepPrompts(now)
    expect([existsSync(old), existsSync(young)]).toEqual([false, true])
  })
})
