// The local gate: each step in order, stopping at the first red.
import { spawnSync } from 'node:child_process'

const steps = [
  ['biome', ['npx', 'biome', 'ci', '.']],
  ['tsc', ['npm', 'run', '--silent', 'typecheck']],
  ['vitest', ['npx', 'vitest', 'run']],
  ['code rules', ['node', 'scripts/check-code-rules.mjs']],
  ['i18n', ['node', 'scripts/check-i18n.mjs']],
  ['test integrity', ['node', 'scripts/check-test-integrity.mjs']],
  ['flaky quarantine', ['node', 'scripts/check-flaky.mjs']],
  ['history', ['node', 'scripts/nothing-lost.mjs']],
]

for (const [name, [command, ...args]] of steps) {
  console.log(`\n▶ ${name}`)
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\n✗ ci: '${name}' failed`)
    process.exit(result.status ?? 1)
  }
}
console.log('\n✓ ci: every step passed')
