import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-key-32-chars-minimum!!',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-32-chars!!',
    },
  },
});
