if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  if (!g.__vitest_worker__) g.__vitest_worker__ = {};
  if (!g.__vitest_worker__.config) g.__vitest_worker__.config = {};
}
import 'vitest-canvas-mock';
