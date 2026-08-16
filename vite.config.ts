import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts', 'src/vite-env.d.ts'],
      thresholds: {
        'src/cart/**': { lines: 80, branches: 80 },
        'src/auth/**': { lines: 80, branches: 80 },
      },
    },
  },
});
