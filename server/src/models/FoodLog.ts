import { Schema, model, Types } from 'mongoose';
import { MEALS } from '@nutritrack/shared';
import { foodSnapshotSchema, nutrientsSchema } from './foodSnapshot';

const foodLogSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    meal: { type: String, enum: MEALS, required: true },
    food: { type: foodSnapshotSchema, required: true },
    servingId: { type: String, required: true },
    servingLabel: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    consumedGrams: { type: Number, default: null },
    nutrients: { type: nutrientsSchema, required: true },
    notes: { type: String, default: null, maxlength: 300 },
    clientRequestId: { type: String, default: undefined },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

foodLogSchema.index({ userId: 1, date: 1, meal: 1, deletedAt: 1 });
foodLogSchema.index({ userId: 1, createdAt: -1 });
foodLogSchema.index(
  { userId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } },
);
// Soft-deleted entries can be restored ("undo") for a day, then MongoDB purges them.
foodLogSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 24 * 3600, partialFilterExpression: { deletedAt: { $type: 'date' } } });

export const FoodLog = model('FoodLog', foodLogSchema);
