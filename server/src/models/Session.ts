import { Schema, model, Types } from 'mongoose';

/**
 * One row per signed-in device. The refresh token itself is never stored; only
 * its SHA-256 hash. `previousTokenHash` supports a short grace window for
 * concurrent refreshes and reuse detection after rotation.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    userAgent: { type: String, default: null, maxlength: 200 },
    lastUsedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true },
);

// Expired sessions are purged by MongoDB 7 days after expiry.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export const Session = model('Session', sessionSchema);
