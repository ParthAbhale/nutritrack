import { createApp } from './app';
import { env, loadEnv } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/db';
import { startReminderJob } from './jobs/reminders';
import { configuredProviders } from './providers/nutrition/registry';

async function main() {
  try {
    loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  const e = env();
  await connectDatabase(e.MONGODB_URI);
  const providers = configuredProviders().map((p) => p.id);
  if (providers.length === 0) logger().warn('No nutrition providers are configured; food search will be unavailable.');
  else logger().info({ providers }, 'Nutrition providers configured');
  if (e.EMAIL_PROVIDER !== 'smtp') logger().warn(`Email delivery is not configured (EMAIL_PROVIDER=${e.EMAIL_PROVIDER}).`);

  const app = createApp();
  const server = app.listen(e.PORT, () => logger().info(`NutriTrack API listening on :${e.PORT}`));
  const stopReminders = e.REMINDERS_ENABLED ? startReminderJob() : () => undefined;

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger().info({ signal }, 'Shutting down gracefully');
    stopReminders();
    server.close(async () => {
      await disconnectDatabase().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger().error({ reason }, 'Unhandled promise rejection'));
}

void main().catch((err) => {
  logger().fatal({ err }, 'Failed to start server');
  process.exit(1);
});
