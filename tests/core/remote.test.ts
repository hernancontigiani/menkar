import { describe, expect, test } from 'vitest'
import { buildCommand } from '../../src/core/command'
import {
  followRemoteControl,
  remoteControlList,
  remoteName,
  setRemoteControl,
} from '../../src/core/remote'
import { parseState } from '../../src/core/state'

describe('Remote Control', () => {
  test('RC-7, RC-9 the name is the display name, trimmed', () => {
    expect(remoteName('fix the login bug', '/a/b', 'd4e5f6a7-0000')).toBe('fix the login bug')
    expect(remoteName('  spaced  ', '/a/b', 'd4e5f6a7-0000')).toBe('spaced')
  })

  test('RC-8 a blank name falls back to the folder, then to the id’s first 8 characters', () => {
    expect(remoteName('  ', '/home/ana/src/shop', 'd4e5f6a7-0000')).toBe('shop')
    expect(remoteName('  ', null, 'd4e5f6a7-0000')).toBe('d4e5f6a7')
  })

  test('RC-5, RC-10 the flag is one argument after the identity, before --settings', () => {
    const opts = { cli: '/usr/bin/claude', settings: '/s.json' }
    expect(
      buildCommand('claude', { kind: 'resume', id: '9c1b' }, { ...opts, remoteControl: 'billing' }),
    ).toBe('/usr/bin/claude --resume 9c1b --remote-control=billing --settings /s.json && exit\n')
    expect(
      buildCommand('claude', { kind: 'resume', id: '9c1b' }, { ...opts, remoteControl: '-x' }),
    ).toContain(' --remote-control=-x ')
  })

  test('RC-22, RC-23 only string ids are on; no key is an empty list', () => {
    expect(remoteControlList(parseState({ remote_control: ['a', 3, null] }))).toEqual(['a'])
    expect(remoteControlList(parseState({}))).toEqual([])
  })

  test('RC-22, RC-24 toggling keeps the list sorted and once; other keys stay', () => {
    let state = parseState({ remote_control: ['a', 3], settings: { x: 1 } })
    state = setRemoteControl(state, 'b', true)
    state = setRemoteControl(state, 'a', true)
    expect(state.rest).toEqual({ remote_control: ['a', 'b'], settings: { x: 1 } })
    expect(remoteControlList(setRemoteControl(state, 'a', false))).toEqual(['b'])
  })

  test('after a clear the new id has Remote Control in the old one’s place; an id without it gives none', () => {
    const state = parseState({ remote_control: ['old', 'z'], settings: { x: 1 } })
    const followed = followRemoteControl(state, 'old', 'new')
    expect(followed.rest).toEqual({ remote_control: ['new', 'z'], settings: { x: 1 } })
    expect(followRemoteControl(state, 'plain', 'other')).toBe(state)
  })
})
