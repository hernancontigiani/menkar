import { join } from 'node:path'

// Cursor names a project folder after its cwd with every `/` (and other characters) turned into
// `-`, so where the real dashes were is lost; it is rebuilt against the filesystem, taking at
// each level the longest run of parts that names an existing directory.
export function cursorCwd(folder: string, isDir: (path: string) => boolean): string {
  const parts = folder.split('-').filter((part) => part.length > 0)
  let path = '/'
  let i = 0
  while (i < parts.length) {
    let found = 0
    for (let end = parts.length; end > i; end -= 1) {
      if (isDir(join(path, parts.slice(i, end).join('-')))) {
        found = end
        break
      }
    }
    if (found === 0) return join(path, ...parts.slice(i))
    path = join(path, parts.slice(i, found).join('-'))
    i = found
  }
  return path
}
