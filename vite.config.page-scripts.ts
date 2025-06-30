import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist/assets',
    emptyOutDir: false, // Don't empty the entire dist directory
    lib: {
      entry: resolve(__dirname, 'src/page-scripts/interceptor.ts'),
      name: 'QCInterceptor',
      formats: ['iife'],
      fileName: () => 'interceptor.js'
    },
    rollupOptions: {
      output: {
        extend: true,
        // Ensure the IIFE is self-contained
        inlineDynamicImports: true,
      }
    },
    minify: 'terser',
    terserOptions: {
      format: {
        comments: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});