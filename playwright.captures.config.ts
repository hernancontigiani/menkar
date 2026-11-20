import { defineConfig } from '@playwright/test'

// The site's captures, not a test suite: `npm run captures` runs it, `npm run ui-check` never does.
export default defineConfig({
  testDir: './e2e/captures',
  testMatch: 'captures.run.ts',
  forbidOnly: true,
  retries: 0,
  // One launch per locale × theme, each on its own X server (e2e/display.ts).
  workers: Number(process.env.MENKAR_E2E_WORKERS ?? 4),
  fullyParallel: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/captures',
})
