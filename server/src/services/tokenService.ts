import type { CookieOptions, Request, Response } from 'express';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { Session } from '../models';
import { randomToken, sha256, safeEqual } from '../utils/crypto';
import { logger } from '../config/logger';

export const ACCESS_COOKIE = 'nt_access';
export const REFRESH_COOKIE = 'nt_refresh';
const REFRESH_PATH = '/api/v1/auth';
/** Concurrent refreshes from several tabs within this window are not treated as token reuse. */
const ROTATION_GRACE_MS = 30_000;

const secretKey = () => new TextEncoder().encode(env().JWT_ACCESS_SECRET);

export function cookieOptions(): CookieOptions {
  const e = env();
  const sameSite = e.COOKIE_SAMESITE;
  return {
    httpOnly: true,
    secure: e.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    domain: e.COOKIE_DOMAIN,
    path: '/',
  };
}

export async function signAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('nutritrack')
    .setAudience('nutritrack-web')
    .setExpirationTime(`${env().ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(secretKey());
}

export type AccessCheck = { status: 'valid'; userId: string; sessionId: string } | { status: 'expired' } | { status: 'invalid' };

export async function verifyAccessToken(token: string): Promise<AccessCheck> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'nutritrack', audience: 'nutritrack-web', algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return { status: 'invalid' };
    if (!Types.ObjectId.isValid(payload.sub) || !Types.ObjectId.isValid(payload.sid)) return { status: 'invalid' };
    return { status: 'valid', userId: payload.sub, sessionId: payload.sid };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { status: 'expired' };
    return { status: 'invalid' };
  }
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string | null) {
  const e = env();
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieOptions(), maxAge: e.ACCESS_TOKEN_TTL_MINUTES * 60_000 });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), path: REFRESH_PATH, maxAge: e.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
  }
}

export function clearAuthCookies(res: Response) {
  const opts = cookieOptions();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, { ...opts, path: REFRESH_PATH });
}

/** Creates a session row and sets the access + refresh cookies. */
export async function startSession(req: Request, res: Response, userId: string): Promise<string> {
  const secret = randomToken(32);
  const session = await Session.create({
    userId,
    tokenHash: sha256(secret),
    userAgent: (req.get('user-agent') ?? '').slice(0, 200) || null,
    expiresAt: new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  const sessionId = String(session._id);
  setAuthCookies(res, await signAccessToken(userId, sessionId), `${sessionId}.${secret}`);
  return sessionId;
}

export type RefreshOutcome = { ok: true; userId: string; sessionId: string } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'reused' };

/**
 * Rotates the refresh token. Presenting the token that was just rotated out
 * (outside the grace window) is treated as theft: the session is revoked.
 */
export async function rotateSession(req: Request, res: Response): Promise<RefreshOutcome> {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== 'string' || !raw.includes('.')) return { ok: false, reason: 'missing' };
  const [sessionId, secret] = raw.split('.', 2) as [string, string];
  if (!Types.ObjectId.isValid(sessionId) || !secret) return { ok: false, reason: 'invalid' };

  const session = await Session.findById(sessionId);
  if (!session || session.revokedAt) return { ok: false, reason: 'invalid' };
  if (session.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  const presented = sha256(secret);
  const userId = String(session.userId);

  if (safeEqual(presented, session.tokenHash)) {
    const next = randomToken(32);
    // Conditional update guards against two concurrent rotations of the same token.
    const updated = await Session.findOneAndUpdate(
      { _id: session._id, tokenHash: session.tokenHash, revokedAt: null },
      { tokenHash: sha256(next), previousTokenHash: session.tokenHash, rotatedAt: new Date(), lastUsedAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!updated) {
      setAuthCookies(res, await signAccessToken(userId, sessionId), null);
      return { ok: true, userId, sessionId };
    }
    setAuthCookies(res, await signAccessToken(userId, sessionId), `${sessionId}.${next}`);
    return { ok: true, userId, sessionId };
  }

  if (!session.previousTokenHash || !safeEqual(presented, session.previousTokenHash)) {
    return { ok: false, reason: 'invalid' }; // unknown secret: reject without touching the session
  }
  const withinGrace = session.rotatedAt && Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
  if (withinGrace) {
    // Another tab already rotated; its response carries the new refresh cookie.
    setAuthCookies(res, await signAccessToken(userId, sessionId), null);
    return { ok: true, userId, sessionId };
  }

  session.revokedAt = new Date();
  session.revokedReason = 'refresh_token_reuse';
  await session.save();
  logger().warn({ sessionId, userId }, 'Refresh token reuse detected; session revoked');
  return { ok: false, reason: 'reused' };
}

export async function revokeSession(sessionId: string, reason: string) {
  await Session.updateOne({ _id: sessionId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

export async function revokeAllSessions(userId: string, reason: string, exceptSessionId?: string) {
  await Session.updateMany(
    { userId, revokedAt: null, ...(exceptSessionId ? { _id: { $ne: new Types.ObjectId(exceptSessionId) } } : {}) },
    { revokedAt: new Date(), revokedReason: reason },
  );
}
