import mongoose, { Types } from 'mongoose';
import {
  calculateConsumed, MEALS, NutritionCalculationError, addDays, diffInDays,
  type CopyDayInput, type DiaryEntry, type DiaryEntryCreateInput, type DiaryEntryUpdateInput, type FoodItem, type Meal,
} from '@nutritrack/shared';
import { FoodLog } from '../models';
import { AppError, badRequest, notFound } from '../utils/errors';
import { supportsTransactions } from '../config/db';
import { resolveFood } from './foodService';
import { toDiaryEntry, toFoodItem, toSnapshot } from './serializers';
import { recordActivity } from './activityService';
import { afterDiaryChange } from './progressService';

const RESTORE_WINDOW_MS = 10 * 60_000;
const ACTIVE = { deletedAt: null };

/** Computes the persisted values of an entry from a food snapshot. */
export function computeEntry(food: FoodItem, servingId: string, quantity: number) {
  const option = food.servings.find((s) => s.id === servingId);
  if (!option) throw badRequest('That serving size is not available for this food', [{ path: 'servingId', message: 'Unknown serving' }]);
  try {
    const { nutrients, consumedGrams } = calculateConsumed(food.nutrients, food.basis, option, quantity);
    return { servingId, servingLabel: option.label, quantity, nutrients, consumedGrams };
  } catch (err) {
    if (err instanceof NutritionCalculationError) throw badRequest(err.message, [{ path: 'quantity', message: err.message }]);
    throw err;
  }
}

async function findOwned(userId: string, entryId: string) {
  if (!Types.ObjectId.isValid(entryId)) throw notFound('Diary entry');
  const doc = await FoodLog.findOne({ _id: entryId, userId, ...ACTIVE });
  if (!doc) throw notFound('Diary entry');
  return doc;
}

function isDuplicateKey(err: unknown) {
  return (err as { code?: number })?.code === 11000;
}

/**
 * Idempotent create: the client generates `clientRequestId` once per logical
 * submission; retries with the same id return the original entry.
 */
export async function createEntry(userId: string, input: DiaryEntryCreateInput): Promise<{ entry: DiaryEntry; created: boolean }> {
  const existing = await FoodLog.findOne({ userId, clientRequestId: input.clientRequestId }).lean();
  if (existing) return { entry: toDiaryEntry(existing), created: false };

  const food = await resolveFood(userId, input.food);
  const computed = computeEntry(food, input.servingId, input.quantity);
  try {
    const doc = await FoodLog.create({
      userId,
      date: input.date,
      meal: input.meal,
      food: toSnapshot(food),
      ...computed,
      notes: input.notes ?? null,
      clientRequestId: input.clientRequestId,
    });
    await recordActivity(userId, 'food_logged', `Logged ${food.name} to ${input.meal}`, input.date);
    await afterDiaryChange(userId, input.date);
    return { entry: toDiaryEntry(doc.toObject()), created: true };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const again = await FoodLog.findOne({ userId, clientRequestId: input.clientRequestId }).lean();
      if (again) return { entry: toDiaryEntry(again), created: false };
    }
    throw err;
  }
}

export async function updateEntry(userId: string, entryId: string, input: DiaryEntryUpdateInput): Promise<DiaryEntry> {
  const doc = await findOwned(userId, entryId);
  const previousDate = doc.date;
  if (input.servingId !== undefined || input.quantity !== undefined) {
    const food = toFoodItem(doc.food); // recalculated from the original snapshot, never refetched
    const computed = computeEntry(food, input.servingId ?? doc.servingId, input.quantity ?? doc.quantity);
    doc.set(computed);
  }
  if (input.meal !== undefined) doc.meal = input.meal;
  if (input.date !== undefined) doc.date = input.date;
  if (input.notes !== undefined) doc.notes = input.notes;
  await doc.save();
  await afterDiaryChange(userId, doc.date);
  if (previousDate !== doc.date) await afterDiaryChange(userId, previousDate);
  return toDiaryEntry(doc.toObject());
}

export async function deleteEntry(userId: string, entryId: string): Promise<DiaryEntry> {
  const doc = await findOwned(userId, entryId);
  doc.deletedAt = new Date();
  await doc.save();
  return toDiaryEntry(doc.toObject());
}

/** Undo for a recent deletion (soft-deleted rows are purged by TTL after 24h). */
export async function restoreEntry(userId: string, entryId: string): Promise<DiaryEntry> {
  if (!Types.ObjectId.isValid(entryId)) throw notFound('Diary entry');
  const doc = await FoodLog.findOneAndUpdate(
    { _id: entryId, userId, deletedAt: { $gte: new Date(Date.now() - RESTORE_WINDOW_MS) } },
    { deletedAt: null },
    { returnDocument: 'after' },
  ).lean();
  if (!doc) throw new AppError(410 as number, 'NOT_FOUND', 'This entry can no longer be restored');
  return toDiaryEntry(doc);
}

export async function duplicateEntry(userId: string, entryId: string, opts: { date?: string; meal?: Meal; clientRequestId: string }) {
  const source = await findOwned(userId, entryId);
  const existing = await FoodLog.findOne({ userId, clientRequestId: opts.clientRequestId }).lean();
  if (existing) return { entry: toDiaryEntry(existing), created: false };
  const copy = source.toObject();
  try {
    const doc = await FoodLog.create({
      userId,
      date: opts.date ?? copy.date,
      meal: opts.meal ?? copy.meal,
      food: copy.food,
      servingId: copy.servingId,
      servingLabel: copy.servingLabel,
      quantity: copy.quantity,
      consumedGrams: copy.consumedGrams,
      nutrients: copy.nutrients,
      notes: copy.notes,
      clientRequestId: opts.clientRequestId,
    });
    await afterDiaryChange(userId, doc.date);
    return { entry: toDiaryEntry(doc.toObject()), created: true };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const again = await FoodLog.findOne({ userId, clientRequestId: opts.clientRequestId }).lean();
      if (again) return { entry: toDiaryEntry(again), created: false };
    }
    throw err;
  }
}

/**
 * Copies entries from one day to another as NEW records (sources are untouched).
 * Each copy gets clientRequestId `${requestId}:${sourceId}`, so repeating the
 * same request cannot create duplicates; inserts run in one transaction when supported.
 */
export async function copyDay(userId: string, input: CopyDayInput) {
  const filter: Record<string, unknown> = { userId, date: input.fromDate, ...ACTIVE };
  if (input.entryIds) filter._id = { $in: input.entryIds.map((id) => new Types.ObjectId(id)) };
  if (input.meals) filter.meal = { $in: input.meals };
  const sources = await FoodLog.find(filter).sort({ createdAt: 1 }).lean();
  if (sources.length === 0) throw badRequest('There are no entries to copy from that day');

  const keyFor = (id: unknown) => `${input.clientRequestId}:${String(id)}`;
  const already = await FoodLog.find({ userId, clientRequestId: { $in: sources.map((s) => keyFor(s._id)) } }).lean();
  if (already.length > 0) return { entries: already.map(toDiaryEntry), created: 0 };

  const docs = sources.map((s) => ({
    userId,
    date: input.toDate,
    meal: s.meal,
    food: s.food,
    servingId: s.servingId,
    servingLabel: s.servingLabel,
    quantity: s.quantity,
    consumedGrams: s.consumedGrams,
    nutrients: s.nutrients,
    notes: s.notes,
    clientRequestId: keyFor(s._id),
  }));

  try {
    let inserted;
    if (await supportsTransactions()) {
      const session = await mongoose.startSession();
      try {
        inserted = await session.withTransaction(() => FoodLog.insertMany(docs, { session }));
      } finally {
        await session.endSession();
      }
    } else {
      inserted = await FoodLog.insertMany(docs);
    }
    await recordActivity(userId, 'food_logged', `Copied ${docs.length} entries from ${input.fromDate} to ${input.toDate}`, input.toDate);
    await afterDiaryChange(userId, input.toDate);
    return { entries: inserted.map((d) => toDiaryEntry(d.toObject())), created: inserted.length };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await FoodLog.find({ userId, clientRequestId: { $in: docs.map((d) => d.clientRequestId) } }).lean();
      return { entries: existing.map(toDiaryEntry), created: 0 };
    }
    throw err;
  }
}

export async function entriesForDate(userId: string, date: string) {
  const docs = await FoodLog.find({ userId, date, ...ACTIVE }).sort({ createdAt: 1 }).lean();
  return docs.map(toDiaryEntry);
}

export const MAX_RANGE_DAYS = 366;

export function assertRange(from: string, to: string, max = MAX_RANGE_DAYS) {
  if (diffInDays(to, from) + 1 > max) throw badRequest(`Date ranges are limited to ${max} days`);
}

export async function entriesForRange(userId: string, from: string, to: string) {
  assertRange(from, to, 62);
  const docs = await FoodLog.find({ userId, date: { $gte: from, $lte: to }, ...ACTIVE }).sort({ date: 1, createdAt: 1 }).lean();
  return docs.map(toDiaryEntry);
}

/** Template items (saved meals) logged as individual entries. */
export async function logTemplateItems(
  userId: string,
  items: { food: FoodItem; servingId: string; quantity: number }[],
  target: { date: string; meal: Meal; clientRequestId: string },
) {
  const keys = items.map((_, i) => `${target.clientRequestId}:${i}`);
  const already = await FoodLog.find({ userId, clientRequestId: { $in: keys } }).lean();
  if (already.length > 0) return { entries: already.map(toDiaryEntry), created: 0 };
  const docs = items.map((item, i) => ({
    userId,
    date: target.date,
    meal: target.meal,
    food: toSnapshot(item.food),
    ...computeEntry(item.food, item.servingId, item.quantity),
    notes: null,
    clientRequestId: keys[i],
  }));
  try {
    const inserted = await FoodLog.insertMany(docs);
    await afterDiaryChange(userId, target.date);
    return { entries: inserted.map((d) => toDiaryEntry(d.toObject())), created: inserted.length };
  } catch (err) {
    if (isDuplicateKey(err)) {
      const existing = await FoodLog.find({ userId, clientRequestId: { $in: keys } }).lean();
      return { entries: existing.map(toDiaryEntry), created: 0 };
    }
    throw err;
  }
}

export { MEALS, addDays };
