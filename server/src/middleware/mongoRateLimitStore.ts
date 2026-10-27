import mongoose from 'mongoose';
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';

/**
 * Shared rate-limit counters kept in MongoDB, for serverless hosting where each
 * request may land on a different instance (in-memory counters would not add up).
 * One atomic upsert per hit; a TTL index removes expired windows.
 */
export class MongoRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;
  private indexed = false;

  constructor(private readonly keyPrefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private col() {
    const col = mongoose.connection.collection<{ _id: string; hits: number; resetTime: Date }>('rate_limits');
    if (!this.indexed) {
      this.indexed = true;
      col.createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 }).catch(() => {
        this.indexed = false;
      });
    }
    return col;
  }

  private key(key: string) {
    return `${this.keyPrefix}:${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date();
    const nextReset = new Date(now.getTime() + this.windowMs);
    const expired = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, now] };
    const doc = await this.col().findOneAndUpdate(
      { _id: this.key(key) },
      [
        {
          $set: {
            hits: { $cond: [expired, 1, { $add: [{ $ifNull: ['$hits', 0] }, 1] }] },
            resetTime: { $cond: [expired, nextReset, '$resetTime'] },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    );
    return { totalHits: doc?.hits ?? 1, resetTime: doc?.resetTime ?? nextReset };
  }

  async decrement(key: string): Promise<void> {
    await this.col().updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key: string): Promise<void> {
    await this.col().deleteOne({ _id: this.key(key) });
  }
}

/** Mongo-backed counters only when RATE_LIMIT_STORE=mongo (set for Vercel); otherwise the default in-memory store. */
export function sharedStore(prefix: string): MongoRateLimitStore | undefined {
  return process.env.RATE_LIMIT_STORE === 'mongo' ? new MongoRateLimitStore(prefix) : undefined;
}
