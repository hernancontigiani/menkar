// Ctrl+click on a terminal link hands it to the system, as GNOME Terminal does (decision 1.59): a
// file: link opens as a path, with the file's default app; any other URL goes as it was written.
import { expect, test } from 'vitest'
import { findPaths, linkTarget, linkUrl, terminalPath } from '../../src/core/links'

test('an http(s) address opens as it was written, its query string included', () => {
  const oauth =
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=123.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback&response_type=code&scope=openid%20email&state=a%2Bb%3D'
  expect(linkUrl(oauth)).toBe(oauth)
  expect(linkUrl('http://localhost:3000/')).toBe('http://localhost:3000/')
  expect(linkUrl('HTTPS://Example.com/A')).toBe('HTTPS://Example.com/A')
  expect(linkTarget(oauth, 'box')).toEqual({ kind: 'url', url: oauth })
})

test.each(['file:///etc/passwd', 'ssh://host', 'mailto:a@b.c', 'vscode://file/x'])(
  '%j is a link, handed to the system as written',
  (uri) => {
    expect(linkUrl(uri)).toBe(uri)
  },
)

test.each(['not a url', '', '/home/me/a.pdf'])('%j is not a link', (uri) => {
  expect(linkUrl(uri)).toBeNull()
  expect(linkTarget(uri, 'box')).toBeNull()
})

test('a file: link opens as its decoded path, on this host only', () => {
  expect(linkTarget('file:///home/me/generated%20docs/r%C3%A9sum%C3%A9.pdf', 'box')).toEqual({
    kind: 'path',
    path: '/home/me/generated docs/résumé.pdf',
  })
  expect(linkTarget('file://localhost/tmp/x', 'box')).toEqual({ kind: 'path', path: '/tmp/x' })
  expect(linkTarget('file://box/tmp/x', 'box')).toEqual({ kind: 'path', path: '/tmp/x' })
  expect(linkTarget('FILE://BOX/tmp/x', 'box')).toEqual({ kind: 'path', path: '/tmp/x' })
  // Another machine's file is not here to open; an escaped slash or NUL is no path.
  expect(linkTarget('file://elsewhere/tmp/x', 'box')).toBeNull()
  expect(linkTarget('file:///tmp/a%2Fb', 'box')).toBeNull()
  expect(linkTarget('file:///tmp/a%00b', 'box')).toBeNull()
})

// A plain absolute path printed in a terminal is a link when it exists (decision 1.64): found here
// as text; main says whether it exists.
const HUMAN =
  '/tmp/claude-1000/-home-hernan-marvik-ccai-guardian/cde751b0-5c1e-4f7a-9d2b-0a1b2c3d4e5f/scratchpad/vis/pick-1-default.png'

const found = (line: string) => findPaths(line).map(({ path, start, end }) => [path, start, end])

test('the path Claude printed as plain text is found, whole, wherever it sits in the row', () => {
  expect(found(HUMAN)).toEqual([[HUMAN, 0, HUMAN.length]])
  const row = `  ⎿  Saved ${HUMAN}`
  expect(found(row)).toEqual([[HUMAN, row.indexOf('/'), row.length]])
})

test('a :line or :line:col suffix is dropped from the path but stays in the link', () => {
  expect(found('error at /home/me/src/a.ts:12:3 here')).toEqual([['/home/me/src/a.ts', 9, 31]])
  expect(found('/home/me/src/a.ts:12')).toEqual([['/home/me/src/a.ts', 0, 20]])
})

test.each([
  ['see /tmp/x.png.', '/tmp/x.png'],
  ['(/tmp/x.png)', '/tmp/x.png'],
  ['wrote /tmp/x.png, then', '/tmp/x.png'],
  ['/tmp/a.ts:12:3,', '/tmp/a.ts'],
  ['[/tmp/x]', '/tmp/x'],
  ['"/tmp/x"', '/tmp/x'],
  ["'/tmp/x';", '/tmp/x'],
  ['/tmp/file(1).png', '/tmp/file(1).png'],
  ['/tmp/copy(1)', '/tmp/copy(1)'],
  ['(see /tmp/file(1).png)', '/tmp/file(1).png'],
  ['~/notes/today.md:', '~/notes/today.md'],
])('trailing punctuation is no part of the path: %j', (line, path) => {
  expect(findPaths(line).map((p) => p.path)).toEqual([path])
})

test('a quoted or backticked path may hold spaces; a bare one ends at the first', () => {
  expect(found('open `/home/me/generated docs/report.pdf` now')).toEqual([
    ['/home/me/generated docs/report.pdf', 6, 40],
  ])
  expect(found('"/home/me/a b.txt"')).toEqual([['/home/me/a b.txt', 1, 17]])
  expect(findPaths('/home/me/generated docs/report.pdf').map((p) => p.path)).toEqual([
    '/home/me/generated',
  ])
  // An opening quote with no closing one on the row: the path runs to whitespace.
  expect(findPaths('`/tmp/a b').map((p) => p.path)).toEqual(['/tmp/a'])
})

test('several paths in a row are each found', () => {
  expect(findPaths('cp /tmp/a ~/b').map((p) => p.path)).toEqual(['/tmp/a', '~/b'])
})

test.each([
  'src/core/links.ts',
  './a.png',
  '../a.png',
  'https://example.com/a/b',
  'file:///tmp/x',
  'a/b/c',
  'x=/tmp/a',
  '~user/a',
  '~',
  '/',
  '// a comment',
  '1/2',
])('%j holds no path', (line) => {
  expect(findPaths(line)).toEqual([])
})

test('~/ expands to the home folder; anything not absolute is no path', () => {
  expect(terminalPath('~/a/b.md', '/home/me')).toBe('/home/me/a/b.md')
  expect(terminalPath('~/a', '/home/me/')).toBe('/home/me/a')
  expect(terminalPath('/tmp/x', '/home/me')).toBe('/tmp/x')
  expect(terminalPath('tmp/x', '/home/me')).toBeNull()
  expect(terminalPath('~user/x', '/home/me')).toBeNull()
  expect(terminalPath('/tmp/a\0b', '/home/me')).toBeNull()
})
