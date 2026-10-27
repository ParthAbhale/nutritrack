import mongoose from 'mongoose';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// NoSQL-injection defence: every request value is parsed by a Zod schema into
// primitive types before reaching a query, and Express 5's default "simple"
// query parser never produces nested objects.

export async function connectDatabase(uri: string, opts: { maxPoolSize?: number } = {}): Promise<void> {
  mongoose.connection.on('disconnected', () => logger().warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger().info('MongoDB reconnected'));
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: opts.maxPoolSize ?? 20, autoIndex: true });
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  logger().info('MongoDB connected');
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

/** Whether the connected deployment supports multi-document transactions (replica set / Atlas). */
export async function supportsTransactions(): Promise<boolean> {
  const db = mongoose.connection.db;
  if (!db) return false;
  try {
    const hello = await db.admin().command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    return false;
  }
}
