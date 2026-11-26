import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM — bundled per entry with code splitting. Shared code lands in chunks, and
  // the output stays tree-shakeable. (Unbundled output emitted extensionless
  // relative imports, which native Node ESM cannot resolve.)
  {
    entry: {
      index: 'src/index.ts',
      'adapters/supabase/index': 'src/adapters/supabase/index.ts',
      'utils/index': 'src/utils/index.ts',
    },
    format: 'esm',
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
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
    noExternal: ['@supabase/supabase-js'],
    banner: { js: '#!/usr/bin/env node' },
    dts: false,
    sourcemap: false,
  },
  // MCP server — stdio, bundled, ESM
  {
    entry: { index: 'src/mcp/index.ts' },
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outDir: 'dist/mcp',
    bundle: true,
    noExternal: ['@supabase/supabase-js'],
    banner: { js: '#!/usr/bin/env node' },
    dts: false,
    sourcemap: false,
  },
]);
