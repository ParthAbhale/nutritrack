import argon2 from 'argon2';
import type { Request, Response } from 'express';
import type { RegisterInput, LoginInput, UserProfile } from '@nutritrack/shared';
import { isValidTimeZone } from '@nutritrack/shared';
import { AuthToken, User, Session } from '../models';
import { AppError, conflict, notFound } from '../utils/errors';
import { randomToken, sha256 } from '../utils/crypto';
import { appUrl } from '../config/env';
import { sendEmail, type DeliveryResult } from './emailService';
import { revokeAllSessions, startSession } from './tokenService';
import { toUserProfile } from './serializers';
import { deleteAllUserData } from './privacyService';

// OWASP-recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 30 * 60_000;

let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= argon2.hash('not-a-real-password-for-timing', HASH_OPTIONS));

export const hashPassword = (password: string) => argon2.hash(password, HASH_OPTIONS);

const INVALID_CREDENTIALS = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

export async function register(req: Request, res: Response, input: RegisterInput, timeZone?: string) {
  const exists = await User.exists({ email: input.email });
  if (exists) throw conflict('An account with this email already exists. Try signing in instead.');
  let user;
  try {
    user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC',
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict('An account with this email already exists. Try signing in instead.');
    throw err;
  }
  await startSession(req, res, String(user._id));
  const delivery = await sendVerificationEmail(String(user._id), user.email, user.name);
  return { user: toUserProfile(user.toObject()), emailDelivery: delivery };
}

export async function login(req: Request, res: Response, input: LoginInput): Promise<UserProfile> {
  const user = await User.findOne({ email: input.email, status: 'active' }).select('+passwordHash +failedLoginCount +lockedUntil');
  if (!user) {
    await argon2.verify(await getDummyHash(), input.password).catch(() => false); // equalize timing
    throw INVALID_CREDENTIALS;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(429, 'RATE_LIMITED', `Too many sign-in attempts. Try again in ${LOCK_MINUTES} minutes or reset your password.`);
  }
  const ok = await argon2.verify(user.passwordHash, input.password).catch(() => false);
  if (!ok) {
    const failed = (user.failedLoginCount ?? 0) + 1;
    await User.updateOne(
      { _id: user._id },
      failed >= MAX_FAILED_LOGINS
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLoginCount: failed },
    );
    throw INVALID_CREDENTIALS;
  }
  if (user.failedLoginCount || user.lockedUntil) await User.updateOne({ _id: user._id }, { failedLoginCount: 0, lockedUntil: null });
  if (argon2.needsRehash(user.passwordHash, HASH_OPTIONS)) {
    await User.updateOne({ _id: user._id }, { passwordHash: await hashPassword(input.password) });
  }
  await startSession(req, res, String(user._id));
  return toUserProfile(user.toObject());
}

async function issueToken(userId: string, type: 'verify_email' | 'reset_password', ttlMs: number) {
  // Only the newest token of each type stays valid.
  await AuthToken.updateMany({ userId, type, usedAt: null }, { usedAt: new Date() });
  const token = randomToken(32);
  await AuthToken.create({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

async function consumeToken(token: string, type: 'verify_email' | 'reset_password') {
  const doc = await AuthToken.findOneAndUpdate(
    { tokenHash: sha256(token), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
  );
  if (!doc) throw new AppError(400, 'INVALID_TOKEN', 'This link is invalid or has expired. Request a new one.');
  return String(doc.userId);
}

export async function sendVerificationEmail(userId: string, email: string, name: string): Promise<DeliveryResult> {
  const token = await issueToken(userId, 'verify_email', VERIFY_TTL_MS);
  const link = `${appUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Verify your NutriTrack email',
    text: `Hi ${name},\n\nConfirm your email address by opening this link (valid for 24 hours):\n${link}\n\nIf you didn't create a NutriTrack account, you can ignore this email.`,
  });
}

export async function resendVerification(userId: string): Promise<DeliveryResult | { alreadyVerified: true }> {
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  return sendVerificationEmail(userId, user.email, user.name);
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, 'verify_email');
  await User.updateOne({ _id: userId, emailVerifiedAt: null }, { emailVerifiedAt: new Date() });
}

/** Always resolves the same way whether or not the account exists. */
export async function forgotPassword(email: string): Promise<DeliveryResult> {
  const user = await User.findOne({ email, status: 'active' });
  if (!user) return { delivered: false, reason: 'not_configured' };
  const token = await issueToken(String(user._id), 'reset_password', RESET_TTL_MS);
  const link = `${appUrl()}/reset-password?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: 'Reset your NutriTrack password',
    text: `Hi ${user.name},\n\nReset your password with this link (valid for 30 minutes, single use):\n${link}\n\nIf you didn't request this, ignore this email; your password won't change.`,
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, 'reset_password');
  await User.updateOne({ _id: userId }, { passwordHash: await hashPassword(password), failedLoginCount: 0, lockedUntil: null });
  await revokeAllSessions(userId, 'password_reset');
}

export async function changePassword(userId: string, sessionId: string, current: string, next: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User');
  const ok = await argon2.verify(user.passwordHash, current).catch(() => false);
  if (!ok) throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect', [{ path: 'currentPassword', message: 'Current password is incorrect' }]);
  user.passwordHash = await hashPassword(next);
  await user.save();
  await revokeAllSessions(userId, 'password_changed', sessionId);
}

export async function deleteAccount(userId: string, password: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User');
  const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!ok) throw new AppError(400, 'VALIDATION_ERROR', 'Password is incorrect', [{ path: 'password', message: 'Password is incorrect' }]);
  await deleteAllUserData(userId);
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).limit(50).lean();
  return sessions.map((s) => ({
    id: String(s._id),
    current: String(s._id) === currentSessionId,
    userAgent: s.userAgent ?? null,
    createdAt: new Date(s.createdAt).toISOString(),
    lastUsedAt: new Date(s.lastUsedAt).toISOString(),
    expiresAt: new Date(s.expiresAt).toISOString(),
  }));
}

export async function revokeOwnSession(userId: string, sessionId: string) {
  const result = await Session.updateOne({ _id: sessionId, userId, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'user_revoked' });
  if (result.matchedCount === 0) throw notFound('Session');
}
