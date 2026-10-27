import type { ActivityItem } from '@nutritrack/shared';
import { Activity } from '../models';
import { logger } from '../config/logger';
import { iso } from './serializers';

export async function recordActivity(userId: string, type: ActivityItem['type'], message: string, date: string | null = null) {
  try {
    await Activity.create({ userId, type, message: message.slice(0, 200), date });
  } catch (err) {
    logger().warn({ err: err instanceof Error ? err.message : err }, 'Failed to record activity');
  }
}

export async function listActivity(userId: string, limit = 15): Promise<ActivityItem[]> {
  const docs = await Activity.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map((d) => ({ id: String(d._id), type: d.type, message: d.message, date: d.date ?? null, createdAt: iso(d.createdAt) }));
}
