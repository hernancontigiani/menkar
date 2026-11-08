// Fails when a row of the e2e quarantine has come due. The point is the date, not the list: a
// quarantine without an expiry is where tests that bother somebody go to die, and nothing about a
// green run would ever say so.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FLAKY = fileURLToPath(new URL('../e2e/FLAKY.md', import.meta.url))
const ROW = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/
// The table's own header and its separator match the shape of a row and are not one.
const HEADER = /^\|\s*test\s*\|/
const SEPARATOR = /^\|[\s:-]*\|[\s:-]*\|[\s:-]*\|\s*$/

/**
 * @typedef {{ test: string, reason: string, expires: string }} Row
 * @param {string} markdown
 * @param {string} today YYYY-MM-DD, local
 * @returns {{ rows: Row[], expired: Row[], errors: string[] }}
 */
export function readQuarantine(markdown, today) {
  /** @type {Row[]} */
  const rows = []
  /** @type {string[]} */
  const errors = []
  for (const [index, line] of markdown.split('\n').entries()) {
    if (HEADER.test(line) || SEPARATOR.test(line)) continue
    const match = ROW.exec(line)
    if (!match) continue
    const [, test = '', reason = '', expires = ''] = match
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
      errors.push(`FLAKY.md line ${index + 1}: '${expires}' is not a date (YYYY-MM-DD)`)
      continue
    }
    rows.push({ test, reason, expires })
  }
  // A row is due on the day it names, in the developer's own time zone.
  return { rows, expired: rows.filter((row) => row.expires < today), errors }
}

/** @param {Date} date */
export function localDay(date) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function main() {
  const { rows, expired, errors } = readQuarantine(
    readFileSync(FLAKY, 'utf8'),
    localDay(new Date()),
  )
  for (const error of errors) console.error(`✗ check-flaky: ${error}`)
  for (const row of expired) {
    console.error(`✗ check-flaky: ${row.test} expired on ${row.expires} (${row.reason})`)
  }
  if (errors.length || expired.length) {
    console.error('  Fix it or delete it. The date is not extended: extending it is the graveyard.')
    process.exit(1)
  }
  console.log(
    rows.length
      ? `check-flaky: ${rows.length} quarantined, none expired`
      : 'check-flaky: the quarantine is empty',
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
