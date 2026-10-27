import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app';
import { env, loadEnv } from './config/env';
import { connectDatabase } from './config/db';

/**
 * Vercel serverless entry. The Express app and the MongoDB connection are created once per
 * function instance and reused by warm invocations. The in-process reminder timer is NOT started
 * here; reminders run via GET /api/cron/reminders instead.
 */
let appPromise: Promise<Express> | undefined;

function init(): Promise<Express> {
  return (async () => {
    loadEnv();
    await connectDatabase(env().MONGODB_URI, { maxPoolSize: 5 });
    return createApp();
  })();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    appPromise ??= init();
    const app = await appPromise;
    app(req, res);
  } catch (err) {
    appPromise = undefined; // retry initialisation on the next request
    console.error('NutriTrack API failed to start:', (err as Error).message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'The API failed to start. Check the function logs and environment variables.' } }));
    }
  }
}
