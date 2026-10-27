import pino from 'pino';
import { env } from './env';

const redact = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["x-csrf-token"]',
    'res.headers["set-cookie"]',
    '*.password',
    '*.newPassword',
    '*.currentPassword',
    '*.token',
  ],
  censor: '[redacted]',
};

function createLogger() {
  const e = env();
  return pino({
    level: e.NODE_ENV === 'test' ? 'silent' : e.LOG_LEVEL,
    redact,
    transport: e.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  });
}

let instance: pino.Logger | undefined;
export function logger(): pino.Logger {
  instance ??= createLogger();
  return instance;
}
