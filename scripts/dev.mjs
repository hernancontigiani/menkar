// On Ubuntu's desktop, AppArmor stops the development build's chrome-sandbox from starting; the
// packaged app does not have that problem, and neither does a run under xvfb-run.
import { spawnSync } from 'node:child_process'

const args = process.platform === 'linux' ? ['--noSandbox'] : []
const result = spawnSync('npx', ['electron-vite', ...args], { stdio: 'inherit' })
process.exit(result.status ?? 1)
