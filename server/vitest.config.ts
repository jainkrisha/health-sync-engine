import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) } },
  test: { include: ['__tests__/**/*.test.ts'], testTimeout: 30000, hookTimeout: 120000, fileParallelism: false },
});
