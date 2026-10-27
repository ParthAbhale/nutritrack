import { Schema, model, Types } from 'mongoose';

const notificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['meal_reminder', 'hydration_reminder', 'goal_reached', 'goal_exceeded', 'milestone', 'system'],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 500 },
    /** Prevents duplicate notifications for the same event (e.g. one goal_reached per day). */
    dedupeKey: { type: String, default: undefined },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
// Notifications are retained for 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export const Notification = model('Notification', notificationSchema);
