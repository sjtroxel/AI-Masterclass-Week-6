import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',   // orbit-math / planet-positions have zero DOM deps
    include: ['tests/**/*.test.ts'],
  },
});
