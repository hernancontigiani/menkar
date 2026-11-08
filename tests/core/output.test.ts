import { describe, expect, it } from 'vitest'
import { OutputJoin } from '../../src/core/output'

describe('joining the attach buffer and the live chunks', () => {
  it('a chunk already in the buffer, arriving after it, is not written twice', () => {
    const join = new OutputJoin()
    expect(join.attach(10)).toBe('')
    expect(join.chunk({ data: 'ready\r\n', end: 10 })).toBe('')
    expect(join.chunk({ data: 'next', end: 14 })).toBe('next')
  })

  it('chunks arriving before the buffer are held, and only those past it are written', () => {
    const join = new OutputJoin()
    expect(join.chunk({ data: 'prompt', end: 6 })).toBe('')
    expect(join.chunk({ data: 'ready', end: 11 })).toBe('')
    expect(join.attach(6)).toBe('ready')
    expect(join.chunk({ data: 'x', end: 12 })).toBe('x')
  })
})
