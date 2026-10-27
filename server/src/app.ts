import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { isDatabaseReady } from './config/db';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { cronRouter } from './routes/cron';

export function createApp() {
  const e = env();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', e.TRUST_PROXY);
  app.set('query parser', 'simple');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger: logger(),
      genReqId: (req) => (req as express.Request).id,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      // Minimal request logging: no headers, cookies or bodies.
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || e.CLIENT_ORIGIN.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => {
    const ready = isDatabaseReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' });
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', database: isDatabaseReady() ? 'connected' : 'disconnected' }));

  app.use('/api/cron', cronRouter());

  app.use('/api/v1', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1', apiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
