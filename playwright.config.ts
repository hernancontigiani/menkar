import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // An `only` left behind silently shrinks the suite to one test.
  forbidOnly: true,
  // A flake shows itself instead of being retried out of sight; e2e/FLAKY.md is where one waits.
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
