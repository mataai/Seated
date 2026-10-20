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
      '@open-seats/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@open-seats/renderer': path.resolve(__dirname, '../renderer/src/index.ts'),
      '@open-seats/viewer': path.resolve(__dirname, '../viewer/src/index.ts'),
      '@open-seats/editor': path.resolve(__dirname, '../editor/src/index.ts'),
    },
  },
  plugins: [
    angular({
      tsconfig: path.resolve(__dirname, 'tsconfig.spec.json'),
    }),
    nxViteTsPaths(),
  ],
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
