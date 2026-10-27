import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { runReminderTick } from '../jobs/reminders';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Serverless replacement for the in-process reminder timer. Call it every ~5 minutes
 * with `Authorization: Bearer <CRON_SECRET>`. Reminders are de-duplicated, so extra calls are harmless.
 * Disabled (404) unless CRON_SECRET is set.
 */
export function cronRouter(): Router {
  const r = Router();
  r.get('/reminders', async (req, res, next) => {
    try {
      const secret = env().CRON_SECRET;
      const given = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1] ?? '';
      if (!secret) return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      if (!safeEqual(given, secret)) return void res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      await runReminderTick();
      logger().info('Reminder tick completed via cron endpoint');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
