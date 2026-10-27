import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// or mongodb+srv:// URI'),
    CLIENT_ORIGIN: z
      .string()
      .min(1)
      .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
    APP_URL: optionalString,
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
    CSRF_SECRET: z.string().min(32, 'must be at least 32 characters'),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: optionalString,
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
    AUTH_RATE_LIMIT: z.coerce.number().int().min(1).max(100000).default(30),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    NUTRITIONIX_APP_ID: optionalString,
    NUTRITIONIX_API_KEY: optionalString,
    USDA_API_KEY: optionalString,
    OPEN_FOOD_FACTS_ENABLED: bool(true),
    OPEN_FOOD_FACTS_USER_AGENT: z.string().default('NutriTrack/1.0 (student project; contact via repository)'),
    ENABLE_FIXTURE_PROVIDER: bool(false),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

    EMAIL_PROVIDER: z.enum(['smtp', 'console', 'none']).default('none'),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    EMAIL_FROM: optionalString,

    REMINDERS_ENABLED: bool(true),
    // Bearer token for GET /api/cron/reminders (serverless hosting, where no always-on reminder job exists).
    CRON_SECRET: z.string().min(16, 'must be at least 16 characters').optional().or(z.literal('').transform(() => undefined)),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === 'smtp' && (!env.SMTP_HOST || !env.EMAIL_FROM)) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_HOST'], message: 'SMTP_HOST and EMAIL_FROM are required when EMAIL_PROVIDER=smtp' });
    }
    if (env.NODE_ENV === 'production') {
      if (env.EMAIL_PROVIDER === 'console') {
        ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'console email is not allowed in production' });
      }
      if (env.ENABLE_FIXTURE_PROVIDER) {
        ctx.addIssue({ code: 'custom', path: ['ENABLE_FIXTURE_PROVIDER'], message: 'test fixtures cannot be enabled in production' });
      }
    }
    if (Boolean(env.NUTRITIONIX_APP_ID) !== Boolean(env.NUTRITIONIX_API_KEY)) {
      ctx.addIssue({ code: 'custom', path: ['NUTRITIONIX_API_KEY'], message: 'set both NUTRITIONIX_APP_ID and NUTRITIONIX_API_KEY, or neither' });
    }
  });

export type Env = z.infer<typeof schema>;

/** Validates process.env. Reports variable names and problems, never values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n${lines.join('\n')}\nSee server/.env.example.`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= loadEnv();
  return cached;
}

/** Test helper: re-read process.env on next access. */
export function resetEnvCache() {
  cached = undefined;
}

export function appUrl(): string {
  const e = env();
  return e.APP_URL ?? e.CLIENT_ORIGIN[0] ?? 'http://localhost:5173';
}
