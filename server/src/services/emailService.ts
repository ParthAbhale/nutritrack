import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export type DeliveryResult = { delivered: true } | { delivered: false; reason: 'not_configured' | 'dev_console' };

let transporter: Transporter | undefined;

export function emailDeliveryConfigured(): boolean {
  return env().EMAIL_PROVIDER === 'smtp';
}

/**
 * Sends an email through SMTP when configured. In development, the `console`
 * provider writes the message to the server log instead and reports that it
 * was NOT delivered. With `none`, nothing is sent and callers are told so.
 */
export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const e = env();
  if (e.EMAIL_PROVIDER === 'smtp') {
    transporter ??= nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
    try {
      await transporter.sendMail({ from: e.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text });
      return { delivered: true };
    } catch (err) {
      logger().error({ err: err instanceof Error ? err.message : err }, 'Email delivery failed');
      throw new AppError(502, 'INTERNAL_ERROR', 'We could not send the email right now. Please try again later.');
    }
  }
  if (e.EMAIL_PROVIDER === 'console') {
    logger().info({ to: message.to, subject: message.subject }, `[dev email, not delivered]\n${message.text}`);
    return { delivered: false, reason: 'dev_console' };
  }
  return { delivered: false, reason: 'not_configured' };
}
