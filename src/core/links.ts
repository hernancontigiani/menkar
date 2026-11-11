// A link in a terminal is handed to the system with Ctrl+click, as GNOME Terminal does: an OSC 8
// hyperlink names any scheme, and the system's own handler for it decides. A string that is not a
// URL at all is no link.
export function linkUrl(uri: string): string | null {
  try {
    new URL(uri)
  } catch (error) {
    if (error instanceof TypeError) return null // not a URL at all
    throw error
  }
  return uri
}

export type LinkTarget =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'url'; readonly url: string }

// A file: link opens as a path, with the file's default app (a folder in the file manager); it
// names this machine when its host is empty, `localhost` or this host's name. Any other URL goes as
// it was written.
export function linkTarget(uri: string, hostname: string): LinkTarget | null {
  if (linkUrl(uri) === null) return null
  const url = new URL(uri)
  if (url.protocol !== 'file:') return { kind: 'url', url: uri }
  const host = url.hostname.toLowerCase()
  if (host !== '' && host !== 'localhost' && host !== hostname.toLowerCase()) return null
  // An escaped slash would be a different path than the one shown; NUL ends a path early.
  if (/%2f|%00/i.test(url.pathname)) return null
  try {
    return { kind: 'path', path: decodeURIComponent(url.pathname) }
  } catch (error) {
    if (error instanceof URIError) return null // an escape that decodes to no character
    throw error
  }
}
