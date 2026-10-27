import { Schema, model, Types } from 'mongoose';

/** Recent-activity feed. Retained for 60 days. */
const activitySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['food_logged', 'goal_changed', 'weight_logged', 'water_logged', 'recipe_saved'], required: true },
    message: { type: String, required: true, maxlength: 200 },
    date: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });

export const Activity = model('Activity', activitySchema);
