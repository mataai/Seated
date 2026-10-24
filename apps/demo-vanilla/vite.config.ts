import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/demo-vanilla',
  server: {
    port: 4201,
    host: 'localhost',
  },
  preview: {
    port: 4301,
    host: 'localhost',
  },
  plugins: [nxViteTsPaths()],
  build: {
    outDir: '../../dist/apps/demo-vanilla',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
});
