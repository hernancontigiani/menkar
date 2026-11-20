// The Developer Certificate of Origin: every commit a change brings carries its author's sign-off
// (`git commit -s`). Merge commits are left out: the sign-off belongs to the work, not the join.
//
// Usage: node scripts/check-dco.mjs <base>   (checks every commit in <base>..HEAD)
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIGN_OFF = /^Signed-off-by: .+ <([^<>\s]+)>\s*$/gm

/**
 * Whether a commit message carries a sign-off whose email is the author's.
 * @param {string} message
 * @param {string} authorEmail
 */
export function signedBy(message, authorEmail) {
  const author = authorEmail.toLowerCase()
  return [...message.matchAll(SIGN_OFF)].some((match) => match[1]?.toLowerCase() === author)
}

/**
 * Each commit in base..HEAD without its author's sign-off, as "<short hash> <subject>".
 * @param {string} root
 * @param {string} base
 * @returns {string[]}
 */
export function unsignedCommits(root, base) {
  const log = execFileSync(
    'git',
    ['log', '--no-merges', '--format=%h%x00%ae%x00%s%x00%B%x1e', `${base}..HEAD`],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  return log
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter(Boolean)
    .flatMap((record) => {
      const [short = '', email = '', subject = '', message = ''] = record.split('\x00')
      return signedBy(message, email) ? [] : [`${short} ${subject}`]
    })
}

function main() {
  const base = process.argv[2]
  if (!base) {
    console.error('✗ dco: name the base to check from: node scripts/check-dco.mjs <base>')
    process.exit(2)
  }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const unsigned = unsignedCommits(root, base)
  if (unsigned.length > 0) {
    console.error(`✗ dco: ${unsigned.length} commit(s) without their author's Signed-off-by:`)
    for (const commit of unsigned) console.error(`  ${commit}`)
    console.error("  Sign each with `git commit -s` (the email must be the commit author's).")
    process.exit(1)
  }
  console.log(`dco: every commit in ${base}..HEAD is signed off by its author`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
