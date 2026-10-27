import { Schema, model, Types } from 'mongoose';
import { foodSnapshotSchema } from './foodSnapshot';

const favoriteSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    providerFoodId: { type: String, required: true },
    food: { type: foodSnapshotSchema, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

favoriteSchema.index({ userId: 1, provider: 1, providerFoodId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });

export const Favorite = model('Favorite', favoriteSchema);
