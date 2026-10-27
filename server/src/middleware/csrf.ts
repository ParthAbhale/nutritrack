import type { RequestHandler, Response, Request } from 'express';
import { env } from '../config/env';
import { hmac, randomToken, safeEqual } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { cookieOptions } from '../services/tokenService';

/**
 * Signed double-submit CSRF protection. A random value lives in an HttpOnly
 * cookie; the client receives `value.signature` in a JSON response body and
 * echoes it in the X-CSRF-Token header. Works when the API is cross-site
 * because the token is read from the response body, not from document.cookie.
 */
export const CSRF_COOKIE = 'nt_csrf';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sign(value: string) {
  return `${value}.${hmac(env().CSRF_SECRET, value)}`;
}

export function issueCsrfToken(req: Request, res: Response): string {
  let value = req.cookies?.[CSRF_COOKIE];
  if (typeof value !== 'string' || !/^[\w-]{32,64}$/.test(value)) {
    value = randomToken(32);
    res.cookie(CSRF_COOKIE, value, { ...cookieOptions(), maxAge: 30 * 24 * 3600 * 1000 });
  }
  return sign(value);
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const header = req.get('x-csrf-token');
  const cookie = req.cookies?.[CSRF_COOKIE];
  if (typeof header !== 'string' || typeof cookie !== 'string') {
    return next(new AppError(403, 'CSRF_INVALID', 'Security token missing. Refresh the page and try again.'));
  }
  if (!safeEqual(header, sign(cookie))) {
    return next(new AppError(403, 'CSRF_INVALID', 'Security token invalid. Refresh the page and try again.'));
  }
  next();
};
