import { Schema, model, Types } from 'mongoose';

/** Water is stored in millilitres. */
const hydrationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    amountMl: { type: Number, required: true, min: 0 },
    clientRequestId: { type: String, default: undefined },
  },
  { timestamps: { createdAt: 'loggedAt', updatedAt: true } },
);
hydrationSchema.index({ userId: 1, date: 1 });
hydrationSchema.index(
  { userId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } },
);

/** Weight is stored in kilograms; one entry per user per day. */
const weightSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    weightKg: { type: Number, required: true, min: 20, max: 400 },
    note: { type: String, default: null, maxlength: 200 },
  },
  { timestamps: true },
);
weightSchema.index({ userId: 1, date: 1 }, { unique: true });

export const HydrationLog = model('HydrationLog', hydrationSchema);
export const WeightLog = model('WeightLog', weightSchema);
