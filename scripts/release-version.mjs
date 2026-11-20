// A release tag names the version package.json holds at the tagged commit, `v` + X.Y.Z exactly:
// the packages take their version from package.json, so a tag saying anything else would publish
// a release whose files are another version. No pre-release tags: a failed candidate is deleted
// and the same version tagged again.
//
// Usage: node scripts/release-version.mjs <tag>   (prints the version; exit 1 with the reason)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TAG = /^v(\d+\.\d+\.\d+)$/

/**
 * @param {string} tag
 * @param {string} version package.json's
 * @returns {string} the version
 */
export function releaseVersion(tag, version) {
  const match = TAG.exec(tag)
  if (!match) throw new Error(`the tag ${tag} is not v<major>.<minor>.<patch>, such as v1.0.0`)
  if (match[1] !== version)
    throw new Error(`the tag ${tag} does not match package.json's version ${version}`)
  return version
}

function main() {
  const tag = process.argv[2] ?? ''
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  try {
    console.log(releaseVersion(tag, version))
  } catch (error) {
    console.error(`✗ release version: ${/** @type {Error} */ (error).message}`)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
