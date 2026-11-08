// Agreement of the app's classifier with hand labels, for a change of its prompt or model.
//
//   node scripts/classify-eval.mjs eval/classifier/sample.json eval/classifier/silver.json
//
// Each file is a JSON list of labelled turns ({prompt, prev_prompt, tools, label}), reported on its
// own, then all together. It sends them through the user's `claude` login with the app's own input,
// command and parsing: one call of the user's quota per 30 turns. Run by hand only, never in CI.
// The label set holds the user's real prompts: `eval/` is git-ignored and deleted when done.
import { spawnSync } from 'node:child_process'
import { accessSync, constants, mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, delimiter, extname, join } from 'node:path'
import { batchInput, command, environment, parseReply } from '../src/core/classifier/input.ts'
import { BATCH, CATEGORIES, TIMEOUT_MS } from '../src/core/classifier/prompt.ts'

const USAGE = 'usage: node scripts/classify-eval.mjs <labels.json> [<labels.json> ...]'

function findClaude() {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, 'claude')
    try {
      if (statSync(candidate).isFile()) {
        accessSync(candidate, constants.X_OK)
        return candidate
      }
    } catch {
      // not in this folder
    }
  }
  return null
}

/** @param {Record<string, unknown>} record */
function turnOf(record) {
  const tools = (Array.isArray(record.tools) ? record.tools : []).map((tool) => ({
    name: tool?.name,
    input: Object.fromEntries(
      ['file_path', 'command', 'pattern']
        .filter((key) => typeof tool?.[key] === 'string')
        .map((key) => [key, tool[key]]),
    ),
  }))
  return {
    prompt: typeof record.prompt === 'string' ? record.prompt : '',
    previous: typeof record.prev_prompt === 'string' ? record.prev_prompt : '',
    tools,
  }
}

/** @param {[string, string | undefined][]} rows */
function agreement(rows) {
  if (rows.length === 0) return 'nothing'
  const right = rows.filter(([label, answer]) => label === answer).length
  return `${right}/${rows.length} = ${Math.round((100 * right) / rows.length)}%`
}

function main(paths) {
  if (paths.length === 0) {
    console.error(USAGE)
    return 2
  }
  const cli = findClaude()
  if (cli === null) {
    console.error('claude is not on PATH.')
    return 1
  }
  // The run's empty folder is a temporary one: the user's data directory stays as it is.
  const folder = join(mkdtempSync(join(tmpdir(), 'classify-eval-')), 'classifier')
  mkdirSync(folder)
  const env = { ...environment(process.env), XDG_DATA_HOME: join(folder, '..') }
  /** @type {Map<string, [string, string | undefined][]>} */
  const bySet = new Map()
  for (const path of paths) {
    const records = JSON.parse(readFileSync(path, 'utf8'))
    const stem = basename(path, extname(path))
    const rows = bySet.get(stem) ?? []
    bySet.set(stem, rows)
    for (let start = 0; start < records.length; start += BATCH) {
      const chunk = records.slice(start, start + BATCH)
      const done = spawnSync(cli, [...command()], {
        input: batchInput(chunk.map(turnOf)),
        cwd: folder,
        env,
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
        maxBuffer: 16 * 1024 * 1024,
      })
      if (done.error || done.status !== 0) {
        console.error((done.stderr ?? '').slice(-2000))
        console.error('Could not run Claude (see the log).')
        return 1
      }
      const answers = parseReply(done.stdout, chunk.length)
      chunk.forEach((record, i) => {
        rows.push([record.label, answers.get(i)])
      })
    }
  }
  const every = [...bySet.values()].flat()
  for (const [name, rows] of bySet) console.log(`${name.padEnd(10)} ${agreement(rows)}`)
  console.log(`${'all'.padEnd(10)} ${agreement(every)}`)
  console.log(
    `${'answered'.padEnd(10)} ${every.filter(([, answer]) => answer !== undefined).length}/${every.length}`,
  )
  for (const category of CATEGORIES) {
    console.log(
      `  ${category.padEnd(9)} recall ${agreement(every.filter(([label]) => label === category))}`,
    )
  }
  return 0
}

process.exitCode = main(process.argv.slice(2))
