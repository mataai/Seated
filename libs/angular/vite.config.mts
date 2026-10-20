/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/angular',
  resolve: {
    alias: {
      konva: path.resolve(__dirname, '../../node_modules/konva/lib/index.js'),
    },
  },
  plugins: [angular(), nxViteTsPaths()],
  test: {
    watch: false,
    globals: true,
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./tests/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/angular',
      provider: 'v8' as const,
    },
  },
}));
