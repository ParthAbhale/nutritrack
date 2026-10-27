import { Schema, model, Types } from 'mongoose';
import { foodSnapshotSchema, nutrientsSchema } from './foodSnapshot';

const templateItemSchema = new Schema(
  {
    food: { type: foodSnapshotSchema, required: true },
    servingId: { type: String, required: true },
    servingLabel: { type: String, required: true },
    quantity: { type: Number, required: true },
    grams: { type: Number, default: null },
    nutrients: { type: nutrientsSchema, required: true },
  },
  { _id: false },
);

/** Saved meals: reusable combinations logged as individual diary entries. Max 30 items. */
const savedMealSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    items: { type: [templateItemSchema], validate: (v: unknown[]) => v.length >= 1 && v.length <= 30 },
  },
  { timestamps: true },
);

/** Recipes: ingredients combined and divided into portions; logged as one entry per portion count. Max 50 items. */
const recipeSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    portions: { type: Number, required: true, min: 0 },
    notes: { type: String, default: null, maxlength: 1000 },
    ingredients: { type: [templateItemSchema], validate: (v: unknown[]) => v.length >= 1 && v.length <= 50 },
    perPortion: { type: nutrientsSchema, required: true },
    gramsPerPortion: { type: Number, default: null },
  },
  { timestamps: true },
);

export const SavedMeal = model('SavedMeal', savedMealSchema);
export const Recipe = model('Recipe', recipeSchema);
