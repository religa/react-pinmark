import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM — unbundled, preserves module structure for tree-shaking
  {
    entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.test.*', '!src/test-setup.ts'],
    format: 'esm',
    dts: true,
    sourcemap: true,
    clean: true,
    bundle: false,
    outDir: 'dist/esm',
    external: ['react', 'react-dom', '@supabase/supabase-js', 'html-to-image'],
  },
  // CJS — bundled (tree-shaking doesn't apply to CJS consumers)
  {
    entry: {
      index: 'src/index.ts',
      supabase: 'src/adapters/supabase/index.ts',
    },
    format: 'cjs',
    dts: false,
    sourcemap: true,
    outDir: 'dist/cjs',
    external: ['react', 'react-dom', '@supabase/supabase-js'],
  },
]);
