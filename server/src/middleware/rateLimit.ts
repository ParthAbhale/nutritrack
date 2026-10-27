import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env';

const handler: Options['handler'] = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.', requestId: req.id },
  });
};

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');
export const userOrIp = (req: Request) => req.auth?.userId ?? ipKey(req);

const base = { standardHeaders: 'draft-8' as const, legacyHeaders: false, handler };

/** Credential endpoints, keyed by IP + email so one attacker can't lock out others. */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => `${ipKey(req)}:${String(req.body?.email ?? '').toLowerCase().slice(0, 254)}`,
});
/** Per-IP ceiling for all auth endpoints (configurable via AUTH_RATE_LIMIT). */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: () => env().AUTH_RATE_LIMIT, keyGenerator: ipKey });
/** Emails (verification, password reset): strict per account/recipient to prevent abuse. */
export const emailLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => req.auth?.userId ?? `${ipKey(req)}:${String(req.body?.email ?? '').toLowerCase().slice(0, 254)}`,
});
export const searchLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 60, keyGenerator: userOrIp });
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, keyGenerator: userOrIp });
export const exportLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 20, keyGenerator: userOrIp });
