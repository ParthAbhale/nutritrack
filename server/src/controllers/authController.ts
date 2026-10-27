import type { Request, Response } from 'express';
import type { ChangePasswordInput } from '../validators/types';
import type { LoginInput, RegisterInput } from '@nutritrack/shared';
import * as auth from '../services/authService';
import { clearAuthCookies, revokeSession, rotateSession, REFRESH_COOKIE } from '../services/tokenService';
import { issueCsrfToken } from '../middleware/csrf';
import { getProfile } from '../services/userService';
import { emailDeliveryConfigured, type DeliveryResult } from '../services/emailService';
import { AppError } from '../utils/errors';
import { valid } from '../middleware/validate';

function deliveryInfo(result: DeliveryResult | { alreadyVerified: true }) {
  if ('alreadyVerified' in result) return { emailSent: false, alreadyVerified: true };
  if (result.delivered) return { emailSent: true };
  return {
    emailSent: false,
    emailNotice:
      result.reason === 'dev_console'
        ? 'Email delivery is not configured. In development the link was written to the server log.'
        : 'Email delivery is not configured on this server, so no email was sent.',
  };
}

export async function csrf(req: Request, res: Response) {
  res.json({ data: { csrfToken: issueCsrfToken(req, res) } });
}

export async function register(req: Request, res: Response) {
  const input = valid<RegisterInput>(req, 'body');
  const timeZone = typeof req.body?.timeZone === 'string' ? req.body.timeZone : undefined;
  const { user, emailDelivery } = await auth.register(req, res, input, timeZone);
  res.status(201).json({ data: { user, csrfToken: issueCsrfToken(req, res), ...deliveryInfo(emailDelivery) } });
}

export async function login(req: Request, res: Response) {
  const user = await auth.login(req, res, valid<LoginInput>(req, 'body'));
  res.json({ data: { user, csrfToken: issueCsrfToken(req, res) } });
}

export async function logout(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw === 'string' && raw.includes('.')) {
    const sessionId = raw.split('.', 1)[0]!;
    if (/^[a-f\d]{24}$/i.test(sessionId)) await revokeSession(sessionId, 'logout');
  } else if (req.auth) {
    await revokeSession(req.auth.sessionId, 'logout');
  }
  clearAuthCookies(res);
  res.status(204).end();
}

export async function refresh(req: Request, res: Response) {
  const outcome = await rotateSession(req, res);
  if (!outcome.ok) {
    clearAuthCookies(res);
    throw new AppError(401, 'UNAUTHENTICATED', outcome.reason === 'reused' ? 'For your security, please sign in again.' : 'Please sign in again.');
  }
  res.json({ data: { user: await getProfile(outcome.userId), csrfToken: issueCsrfToken(req, res) } });
}

export async function me(req: Request, res: Response) {
  res.json({ data: { user: await getProfile(req.auth!.userId), csrfToken: issueCsrfToken(req, res) } });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = valid<{ email: string }>(req, 'body');
  await auth.forgotPassword(email);
  res.status(202).json({
    data: {
      message: 'If an account exists for that email, a reset link has been sent.',
      emailDeliveryConfigured: emailDeliveryConfigured(),
    },
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = valid<{ token: string; password: string }>(req, 'body');
  await auth.resetPassword(token, password);
  clearAuthCookies(res);
  res.json({ data: { message: 'Your password has been reset. Sign in with your new password.' } });
}

export async function verifyEmail(req: Request, res: Response) {
  await auth.verifyEmail(valid<{ token: string }>(req, 'body').token);
  res.json({ data: { message: 'Email verified' } });
}

export async function resendVerification(req: Request, res: Response) {
  const result = await auth.resendVerification(req.auth!.userId);
  res.json({ data: deliveryInfo(result) });
}

export async function changePassword(req: Request, res: Response) {
  const input = valid<ChangePasswordInput>(req, 'body');
  await auth.changePassword(req.auth!.userId, req.auth!.sessionId, input.currentPassword, input.newPassword);
  res.json({ data: { message: 'Password changed. Other devices have been signed out.' } });
}
