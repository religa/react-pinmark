import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM — unbundled, preserves module structure for tree-shaking
  {
    entry: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.test.*', '!src/test-setup.ts', '!src/cli/**'],
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
      utils: 'src/utils/index.ts',
    },
    format: 'cjs',
    dts: false,
    sourcemap: true,
    outDir: 'dist/cjs',
    external: ['react', 'react-dom', '@supabase/supabase-js'],
  },
  // CLI — Node.js entry point, bundled, ESM
  {
    entry: { index: 'src/cli/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outDir: 'dist/cli',
    bundle: true,
    banner: { js: '#!/usr/bin/env node' },
    external: ['@supabase/supabase-js'],
    dts: false,
    sourcemap: false,
  },
]);
