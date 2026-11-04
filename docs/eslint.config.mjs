import baseConfig from '../eslint.config.mjs';

export default [
  ...baseConfig,
  { ignores: ['.vitepress/cache/**', '.vitepress/dist/**'] },
  {
    // Docs may use every package (like the demo apps). The live demo imports
    // them lazily so the static build never touches the DOM, while snippets
    // import them normally; Nx would otherwise flag that mix.
    files: ['**/*.ts', '**/*.mts'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
  {
    // Snippets are examples for readers: logging and `getElementById(...)!`
    // keep them short. They are still type-checked (`nx typecheck docs`).
    files: ['snippets/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
