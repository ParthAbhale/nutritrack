import { Schema } from 'mongoose';
import { NUTRIENT_KEYS, PROVIDERS } from '@nutritrack/shared';

const nutrientFields = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { type: Number, default: null }]));

export const nutrientsSchema = new Schema(nutrientFields, { _id: false });

/**
 * Immutable copy of a normalized FoodItem at the time it was used. Diary
 * entries keep this so later provider changes never alter history.
 */
export const foodSnapshotSchema = new Schema(
  {
    provider: { type: String, enum: PROVIDERS, required: true },
    providerFoodId: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: null },
    barcode: { type: String, default: null },
    imageUrl: { type: String, default: null },
    category: { type: String, default: null },
    kind: { type: String, enum: ['branded', 'generic', 'custom', 'recipe'], required: true },
    basis: {
      type: { type: String, enum: ['per100g', 'per100ml', 'perServing'], required: true },
      servingGrams: { type: Number, default: null },
    },
    nutrients: { type: nutrientsSchema, required: true },
    servings: [{ _id: false, id: String, label: String, grams: { type: Number, default: null }, isBasisServing: Boolean }],
    defaultServingId: { type: String, required: true },
    completeness: { type: String, enum: ['complete', 'partial', 'unknown'], required: true },
    detailed: { type: Boolean, default: true },
    ingredientsText: { type: String, default: null },
    allergens: { type: [String], default: null },
    attribution: { type: String, required: true },
    sourceUrl: { type: String, default: null },
    fetchedAt: { type: Date, required: true },
  },
  { _id: false },
);
