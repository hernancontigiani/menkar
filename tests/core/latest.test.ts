import { expect, test } from 'vitest'
import { latestOnly } from '../../src/core/latest'

// docs/spec/usage.md USG-54 and docs/spec/classifier.md CLS-32: of two questions in flight, only
// the later one's answer is shown, whichever answer arrives first.

async function race(firstDelay: number, secondDelay: number): Promise<string[]> {
  const ask = latestOnly()
  const shown: string[] = []
  const answer = (value: string, delay: number) =>
    new Promise<string>((resolve) => setTimeout(() => resolve(value), delay))
  const question = async (value: string, delay: number) => {
    const current = ask()
    const got = await answer(value, delay)
    if (current()) shown.push(got)
  }
  await Promise.all([question('30 days', firstDelay), question('Today', secondDelay)])
  return shown
}

test('USG-54, CLS-32 the earlier answer arriving last is dropped', async () => {
  expect(await race(30, 1)).toEqual(['Today'])
})

test('USG-54, CLS-32 the earlier answer arriving first is dropped too', async () => {
  expect(await race(1, 30)).toEqual(['Today'])
})

test('a lone question is current until another is asked', () => {
  const ask = latestOnly()
  const first = ask()
  expect(first()).toBe(true)
  const second = ask()
  expect(first()).toBe(false)
  expect(second()).toBe(true)
})
