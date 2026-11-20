// A release's notes are its section of CHANGELOG.md, the one place they are written: the section
// whose `## ` heading starts with the version (`## 1.0.0 — …` or `## [1.0.0] …`), up to the next
// `## ` heading. A release without its section is refused rather than published with no notes.
//
// Usage: node scripts/release-notes.mjs <version> <out-path>
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @param {string} text */
const literal = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/**
 * @param {string} changelog CHANGELOG.md's text
 * @param {string} version X.Y.Z
 * @returns {string} the section's body, trimmed
 */
export function releaseNotes(changelog, version) {
  const heading = new RegExp(`^## (?:\\[${literal(version)}\\]|${literal(version)})(?![\\w.])`)
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex((line) => heading.test(line))
  if (start === -1) throw new Error(`CHANGELOG.md has no section for ${version}`)
  const next = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  const body = lines
    .slice(start + 1, next === -1 ? undefined : next)
    .join('\n')
    .trim()
  if (body === '') throw new Error(`CHANGELOG.md's section for ${version} is empty`)
  return body
}

function main() {
  const [version, out] = process.argv.slice(2)
  if (!version || !out) {
    console.error('✗ release notes: node scripts/release-notes.mjs <version> <out-path>')
    process.exit(2)
  }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  try {
    let changelog
    try {
      changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ENOENT') throw error
      throw new Error('there is no CHANGELOG.md')
    }
    writeFileSync(out, `${releaseNotes(changelog, version)}\n`)
  } catch (error) {
    console.error(`✗ release notes: ${/** @type {Error} */ (error).message}`)
    process.exit(1)
  }
  console.log(`release notes: CHANGELOG.md's section for ${version} written to ${out}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
