import { Schema, model, Types } from 'mongoose';
import { nutrientsSchema } from './foodSnapshot';

const customFoodSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 120 },
    brand: { type: String, default: null, maxlength: 80 },
    servingLabel: { type: String, required: true, maxlength: 40 },
    servingGrams: { type: Number, default: null },
    nutrients: { type: nutrientsSchema, required: true },
  },
  { timestamps: true },
);

export const CustomFood = model('CustomFood', customFoodSchema);
