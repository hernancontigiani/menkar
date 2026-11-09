// A path under the user's home as ~/…, by the home folder's own prefix (no Node: the renderer
// shows it).
export function tilde(path: string, home: string): string {
  const h = home.replace(/\/+$/, '')
  if (!h) return path
  return path === h || path.startsWith(`${h}/`) ? `~${path.slice(h.length)}` : path
}
