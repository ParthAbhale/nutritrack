import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real API and web app against an isolated
 * in-memory MongoDB, using the synthetic fixture nutrition provider so
 * results are deterministic and no external API is called.
 */
const API_PORT = 4100;
const WEB_PORT = 5174;
const DB_PORT = 27019;

const apiEnv = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  MONGODB_URI: `mongodb://127.0.0.1:${DB_PORT}/nutritrack_e2e?replicaSet=testset`,
  CLIENT_ORIGIN: `http://localhost:${WEB_PORT}`,
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdefghijklmnop',
  CSRF_SECRET: 'e2e-csrf-secret-0123456789abcdefghijklmnopqr',
  ENABLE_FIXTURE_PROVIDER: 'true',
  OPEN_FOOD_FACTS_ENABLED: 'false',
  USDA_API_KEY: '',
  EMAIL_PROVIDER: 'console',
  REMINDERS_ENABLED: 'false',
  AUTH_RATE_LIMIT: '10000',
  LOG_LEVEL: 'warn',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: [
    { command: 'node ../server/scripts/e2e-db.mjs', port: DB_PORT, env: { E2E_DB_PORT: String(DB_PORT) }, reuseExistingServer: false, timeout: 120_000 },
    { command: 'npx tsx ../server/src/server.ts', url: `http://localhost:${API_PORT}/health/ready`, env: apiEnv, reuseExistingServer: false, timeout: 60_000 },
    { command: `npx vite --port ${WEB_PORT} --strictPort`, url: `http://localhost:${WEB_PORT}`, env: { VITE_DEV_API_PROXY: `http://localhost:${API_PORT}` }, reuseExistingServer: false, timeout: 60_000 },
  ],
});
