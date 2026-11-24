// A Cursor pane's chat changes with no hook to say so: `/new` and `/resume` inside its TUI (measured
// by `cursor` on 2026.11.13-eacade1, 2026-11-23). A turn then ends under the other chat's id, and
// the chat's own metadata says when it was made: after the pane started, `/new` made it and it takes
// the old one's place; before, an older chat was reopened.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { createdAt, cursorFollow } from '../../../../src/core/agents/cursor/follow'

const STARTED = 1_795_470_900_000
const NEW_CHAT = '7d3c1b2a-0000-4000-8000-00000000000a'
const OLD_CHAT = '7d3c1b2a-0000-4000-8000-00000000000b'

function chats(): string {
  const root = mkdtempSync(join(process.env.MENKAR_TEST_ROOT ?? '', 'cursor-chats-'))
  const meta = (hash: string, id: string, created: unknown) => {
    mkdirSync(join(root, hash, id), { recursive: true })
    writeFileSync(
      join(root, hash, id, 'meta.json'),
      JSON.stringify({ schemaVersion: 1, createdAtMs: created, title: 'A title', cwd: '/w' }),
    )
  }
  meta('0f1e2d3c4b5a69788796a5b4c3d2e1f0', NEW_CHAT, STARTED + 120_000)
  meta('aa1e2d3c4b5a69788796a5b4c3d2e1f0', OLD_CHAT, STARTED - 3_600_000)
  meta('bb1e2d3c4b5a69788796a5b4c3d2e1f0', 'no-time', 'yesterday')
  return root
}

test.each([
  ['a chat made after the pane started (/new) takes the old one’s place', NEW_CHAT, 'clear'],
  ['an older chat reopened (/resume) is another session', OLD_CHAT, 'resume'],
  ['a chat Cursor keeps no metadata for is not followed', 'unknown-chat', null],
  ['a chat whose metadata says no time is not followed', 'no-time', null],
])('%s', async (_name, to, kind) => {
  const root = chats()
  const follow = cursorFollow(() => root)
  expect(await follow.classify(null, { to, paneStartedAt: STARTED })).toBe(kind)
})

test('with no change named, or no chats folder yet, nothing is followed', async () => {
  const follow = cursorFollow(() => join(chats(), 'missing'))
  expect(await follow.classify(null)).toBeNull()
  expect(await follow.classify(null, { to: NEW_CHAT, paneStartedAt: STARTED })).toBeNull()
  expect(await createdAt(chats(), '../escape')).toBeNull()
})
