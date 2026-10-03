// Bundles the server (and the shared merge engine it imports) into dist/index.js.
// npm packages stay external and are installed in the production image.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: ['src/index.ts', 'src/seed.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  packages: 'external',
  alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
});
console.log('Built server to dist/');
