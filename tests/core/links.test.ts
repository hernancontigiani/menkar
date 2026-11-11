// Ctrl+click on a terminal link hands it to the system, as GNOME Terminal does (decision 1.59): a
// file: link opens as a path, with the file's default app; any other URL goes as it was written.
import { expect, test } from 'vitest'
import { linkTarget, linkUrl } from '../../src/core/links'

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
