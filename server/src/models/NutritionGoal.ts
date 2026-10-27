import { Schema, model, Types } from 'mongoose';

/** Goals are versioned by effective date; the goal for a day is the latest with effectiveFrom <= day. */
const goalSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    effectiveFrom: { type: String, required: true },
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },
    carbs: { type: Number, required: true, min: 0 },
    fat: { type: Number, required: true, min: 0 },
    fiber: { type: Number, default: null, min: 0 },
    waterMl: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['manual', 'estimate'], default: 'manual' },
  },
  { timestamps: true },
);

goalSchema.index({ userId: 1, effectiveFrom: -1 }, { unique: true });

export const NutritionGoal = model('NutritionGoal', goalSchema);
