import type { AppNotification, PageMeta } from '@nutritrack/shared';
import { Notification, User } from '../models';
import { notFound } from '../utils/errors';
import { iso } from './serializers';
import { sendEmail } from './emailService';

export async function notify(
  userId: string,
  input: { type: AppNotification['type']; title: string; body: string; dedupeKey?: string; email?: boolean },
): Promise<boolean> {
  try {
    await Notification.create({ userId, type: input.type, title: input.title, body: input.body, dedupeKey: input.dedupeKey });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false; // already notified for this event
    throw err;
  }
  if (input.email) {
    const user = await User.findById(userId).select('email notifications emailVerifiedAt').lean();
    // Only email verified addresses that opted in; delivery outcome is not claimed unless SMTP confirms.
    if (user?.notifications?.email && user.emailVerifiedAt) {
      await sendEmail({ to: user.email, subject: input.title, text: `${input.body}\n\nManage notifications in NutriTrack settings.` }).catch(() => undefined);
    }
  }
  return true;
}

export async function listNotifications(userId: string, page: number, pageSize: number): Promise<{ items: AppNotification[]; meta: PageMeta; unread: number }> {
  const [docs, total, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return {
    items: docs.map((d) => ({ id: String(d._id), type: d.type, title: d.title, body: d.body, read: Boolean(d.readAt), createdAt: iso(d.createdAt) })),
    meta: { page, pageSize, total, hasMore: page * pageSize < total },
    unread,
  };
}

export async function setRead(userId: string, id: string, read: boolean) {
  const doc = await Notification.findOneAndUpdate({ _id: id, userId }, { readAt: read ? new Date() : null }, { returnDocument: 'after' }).lean();
  if (!doc) throw notFound('Notification');
  return { id: String(doc._id), type: doc.type, title: doc.title, body: doc.body, read: Boolean(doc.readAt), createdAt: iso(doc.createdAt) };
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ userId, readAt: null }, { readAt: new Date() });
}
