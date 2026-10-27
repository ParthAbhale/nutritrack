import { Schema, model, Types } from 'mongoose';

const searchHistorySchema = new Schema({
  userId: { type: Types.ObjectId, ref: 'User', required: true },
  query: { type: String, required: true, maxlength: 100 },
  lastUsedAt: { type: Date, default: () => new Date() },
});

searchHistorySchema.index({ userId: 1, query: 1 }, { unique: true });
searchHistorySchema.index({ userId: 1, lastUsedAt: -1 });

export const SearchHistory = model('SearchHistory', searchHistorySchema);
