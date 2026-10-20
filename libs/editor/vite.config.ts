/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/editor',
  resolve: {
    alias: {
      konva: path.resolve(__dirname, '../../node_modules/konva/lib/index.js'),
    },
  },
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: '../../dist/libs/editor',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'OpenSeatsEditor',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        '@open-seats/core',
        '@open-seats/renderer',
        '@open-seats/viewer',
        'konva',
      ],
    },
  },
  test: {
    watch: false,
    globals: true,
    passWithNoTests: true,
    environment: 'jsdom',
    setupFiles: ['./tests/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/editor',
      provider: 'v8' as const,
    },
  },
}));
