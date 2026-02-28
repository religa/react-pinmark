import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // More specific entry must come first
      {
        find: 'react-pinmark/supabase',
        replacement: fileURLToPath(new URL('../src/adapters/supabase/index.ts', import.meta.url)),
      },
      {
        find: 'react-pinmark',
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
    ],
  },
});
