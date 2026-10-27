import { todayInTimeZone, type ProfileUpdateInput } from '@nutritrack/shared';
import { User } from '../models';
import { notFound } from '../utils/errors';
import { toUserProfile } from './serializers';

export async function getUser(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user || user.status !== 'active') throw notFound('User');
  return user;
}

export async function getProfile(userId: string) {
  return toUserProfile(await getUser(userId));
}

/** The user's current local calendar date, per their profile time zone. */
export async function userToday(userId: string): Promise<{ today: string; timeZone: string }> {
  const user = await User.findById(userId).select('timeZone').lean();
  const timeZone = user?.timeZone ?? 'UTC';
  return { today: todayInTimeZone(timeZone), timeZone };
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  const doc = await User.findOneAndUpdate(
    { _id: userId, status: 'active' },
    { $set: { ...input, profileUpdatedAt: new Date() } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!doc) throw notFound('User');
  return toUserProfile(doc);
}

export async function addMilestone(userId: string, input: { title: string; type: string; target: number }) {
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  if (user.milestones.length >= 20) user.milestones.shift();
  user.milestones.push({ ...input, achievedAt: null });
  await user.save();
  return toUserProfile(user.toObject());
}

export async function removeMilestone(userId: string, milestoneId: string) {
  const result = await User.updateOne({ _id: userId }, { $pull: { milestones: { _id: milestoneId } } });
  if (result.modifiedCount === 0) throw notFound('Milestone');
}
