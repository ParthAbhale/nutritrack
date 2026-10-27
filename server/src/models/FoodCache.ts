import { Schema, model } from 'mongoose';
import { foodSnapshotSchema } from './foodSnapshot';

/** Shared cache of normalized public provider data (no user data). Expires after 7 days. */
const foodCacheSchema = new Schema({
  key: { type: String, required: true, unique: true },
  food: { type: foodSnapshotSchema, required: true },
  cachedAt: { type: Date, default: () => new Date() },
});

foodCacheSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export const FoodCache = model('FoodCache', foodCacheSchema);
