import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      thresholds: {
        lines: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
});
