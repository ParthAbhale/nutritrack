import { Schema, model, Types } from 'mongoose';

/** Single-use, time-limited tokens for email verification and password reset (hash only). */
const authTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['verify_email', 'reset_password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });

export const AuthToken = model('AuthToken', authTokenSchema);
