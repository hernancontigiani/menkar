import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // An `only` left behind silently shrinks the suite to one test.
  forbidOnly: true,
  // A flake shows itself instead of being retried out of sight; e2e/FLAKY.md is where one waits.
  retries: 0,
  // Each worker draws on an X server of its own (e2e/display.ts), so tests run side by side;
  // within a file too, since two files hold most of the suite. Four was measured as the fastest
  // count that stays green: more made load-sensitive tests fail.
  workers: Number(process.env.MENKAR_E2E_WORKERS ?? 4),
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
