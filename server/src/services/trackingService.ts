import { Types } from 'mongoose';
import type { HydrationDay, HydrationLog as HydrationDto, WeightLog as WeightDto } from '@nutritrack/shared';
import { HydrationLog, WeightLog } from '../models';
import { notFound } from '../utils/errors';
import { iso } from './serializers';
import { goalForDate } from './goalService';
import { recordActivity } from './activityService';
import { checkMilestones } from './progressService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toHydration = (d: any): HydrationDto => ({ id: String(d._id), date: d.date, amountMl: d.amountMl, loggedAt: iso(d.loggedAt) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toWeight = (d: any): WeightDto => ({ id: String(d._id), date: d.date, weightKg: d.weightKg, note: d.note ?? null, createdAt: iso(d.createdAt) });

export async function hydrationDay(userId: string, date: string): Promise<HydrationDay> {
  const [logs, goal] = await Promise.all([HydrationLog.find({ userId, date }).sort({ loggedAt: 1 }).lean(), goalForDate(userId, date)]);
  const items = logs.map(toHydration);
  return { date, totalMl: items.reduce((s, l) => s + l.amountMl, 0), goalMl: goal?.waterMl ?? null, logs: items };
}

export async function addHydration(userId: string, input: { date: string; amountMl: number; clientRequestId?: string }) {
  if (input.clientRequestId) {
    const existing = await HydrationLog.findOne({ userId, clientRequestId: input.clientRequestId }).lean();
    if (existing) return toHydration(existing);
  }
  try {
    const doc = await HydrationLog.create({ userId, ...input });
    await recordActivity(userId, 'water_logged', `Logged ${Math.round(input.amountMl)} ml of water`, input.date);
    return toHydration(doc.toObject());
  } catch (err) {
    if ((err as { code?: number }).code === 11000 && input.clientRequestId) {
      const existing = await HydrationLog.findOne({ userId, clientRequestId: input.clientRequestId }).lean();
      if (existing) return toHydration(existing);
    }
    throw err;
  }
}

export async function updateHydration(userId: string, id: string, amountMl: number) {
  const doc = await HydrationLog.findOneAndUpdate({ _id: id, userId }, { amountMl }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Water log');
  return toHydration(doc);
}

export async function deleteHydration(userId: string, id: string) {
  const res = await HydrationLog.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw notFound('Water log');
}

export async function hydrationHistory(userId: string, from: string, to: string) {
  const rows = await HydrationLog.aggregate<{ _id: string; total: number }>([
    { $match: { userId: new Types.ObjectId(userId), date: { $gte: from, $lte: to } } },
    { $group: { _id: '$date', total: { $sum: '$amountMl' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, totalMl: r.total }));
}

export async function listWeights(userId: string, from?: string, to?: string) {
  const filter: Record<string, unknown> = { userId };
  if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const docs = await WeightLog.find(filter).sort({ date: 1 }).limit(1000).lean();
  return docs.map(toWeight);
}

/** One weight per day: logging again on the same date replaces that day's value. */
export async function upsertWeight(userId: string, input: { date: string; weightKg: number; note?: string | null }) {
  const doc = await WeightLog.findOneAndUpdate(
    { userId, date: input.date },
    { $set: { weightKg: input.weightKg, note: input.note ?? null } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();
  await recordActivity(userId, 'weight_logged', `Recorded weight for ${input.date}`, input.date);
  await checkMilestones(userId).catch(() => undefined);
  return toWeight(doc);
}

export async function updateWeight(userId: string, id: string, input: { weightKg?: number; note?: string | null }) {
  const doc = await WeightLog.findOneAndUpdate({ _id: id, userId }, { $set: input }, { returnDocument: 'after', runValidators: true }).lean();
  if (!doc) throw notFound('Weight entry');
  return toWeight(doc);
}

export async function deleteWeight(userId: string, id: string) {
  const res = await WeightLog.deleteOne({ _id: id, userId });
  if (res.deletedCount === 0) throw notFound('Weight entry');
}
