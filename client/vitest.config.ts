import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) } },
  test: {
    // The shared merge engine tests live in ../shared and run from here.
    dir: '..',
    include: ['shared/**/*.test.ts', 'client/src/**/*.test.ts'],
    environment: 'node',
  },
});
