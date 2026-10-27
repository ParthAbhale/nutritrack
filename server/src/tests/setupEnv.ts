import { inject } from 'vitest';

const base = inject('mongoUri');
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: base.replace(/\/(\?|$)/, `/nutritrack_test_${process.pid}$1`),
  CLIENT_ORIGIN: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-123',
  CSRF_SECRET: 'test-csrf-secret-that-is-long-enough-456789',
  ENABLE_FIXTURE_PROVIDER: 'true',
  OPEN_FOOD_FACTS_ENABLED: 'false',
  USDA_API_KEY: '',
  NUTRITIONIX_APP_ID: '',
  NUTRITIONIX_API_KEY: '',
  EMAIL_PROVIDER: 'console',
  REMINDERS_ENABLED: 'false',
  AUTH_RATE_LIMIT: '10000',
});
