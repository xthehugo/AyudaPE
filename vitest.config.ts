import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './src/shared'),
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
