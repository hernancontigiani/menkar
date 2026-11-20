import { defineConfig } from 'vitest/config'

export default defineConfig({
  tsconfig: 'tsconfig.node.json',
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
