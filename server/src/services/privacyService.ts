import mongoose, { Types } from 'mongoose';
import {
  Activity, AuthToken, CustomFood, Favorite, FoodLog, HydrationLog, Notification, NutritionGoal, Recipe, SavedMeal,
  SearchHistory, Session, User, WeightLog,
} from '../models';
import { supportsTransactions } from '../config/db';

const USER_OWNED = [Activity, AuthToken, CustomFood, Favorite, FoodLog, HydrationLog, Notification, NutritionGoal, Recipe, SavedMeal, SearchHistory, Session, WeightLog];

/**
 * Account deletion: hard-deletes every user-owned record and the user. Runs in
 * a transaction where supported (Atlas/replica sets). No retention period
 * applies; MongoDB Atlas backups age out per the cluster's backup policy.
 */
export async function deleteAllUserData(userId: string) {
  const id = new Types.ObjectId(userId);
  const run = async (session?: mongoose.ClientSession) => {
    for (const model of USER_OWNED) {
      await (model as mongoose.Model<unknown>).deleteMany({ userId: id }, { session });
    }
    await User.deleteOne({ _id: id }, { session });
  };
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() => run(session));
    } finally {
      await session.endSession();
    }
  } else {
    await run();
  }
}
