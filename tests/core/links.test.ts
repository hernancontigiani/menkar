// Ctrl+click on a terminal link: only http(s) addresses go to the browser, whole and unchanged.
import { expect, test } from 'vitest'
import { webLink } from '../../src/core/links'

test('an http(s) address opens as it was written, its query string included', () => {
  const oauth =
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=123.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A54545%2Fcallback&response_type=code&scope=openid%20email&state=a%2Bb%3D'
  expect(webLink(oauth)).toBe(oauth)
  expect(webLink('http://localhost:3000/')).toBe('http://localhost:3000/')
  expect(webLink('HTTPS://Example.com/A')).toBe('HTTPS://Example.com/A')
})

test.each([
  'file:///etc/passwd',
  'ssh://host',
  'javascript:alert(1)',
  'mailto:a@b.c',
  'vscode://file/x',
  'not a url',
  '',
])('%j is not opened', (uri) => {
  expect(webLink(uri)).toBeNull()
})
