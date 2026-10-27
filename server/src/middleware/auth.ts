import type { RequestHandler } from 'express';
import { AppError, unauthenticated } from '../utils/errors';
import { verifyAccessToken, ACCESS_COOKIE } from '../services/tokenService';
import { Session } from '../models';

/**
 * Requires a valid access token cookie and a live (non-revoked, unexpired)
 * session. The authenticated user id comes only from the verified token,
 * never from client-supplied fields.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== 'string' || !token) return next(unauthenticated());
  const result = await verifyAccessToken(token);
  if (result.status === 'expired') return next(new AppError(401, 'TOKEN_EXPIRED', 'Session expired'));
  if (result.status !== 'valid') return next(unauthenticated());
  const session = await Session.findById(result.sessionId).select('userId revokedAt expiresAt').lean();
  if (!session || session.revokedAt || session.expiresAt < new Date() || String(session.userId) !== result.userId) {
    return next(unauthenticated('Your session has ended. Please sign in again.'));
  }
  req.auth = { userId: result.userId, sessionId: result.sessionId };
  next();
};

export function authUserId(req: { auth?: { userId: string } }): string {
  if (!req.auth) throw unauthenticated();
  return req.auth.userId;
}
