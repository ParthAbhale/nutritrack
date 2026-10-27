import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ALLERGENS, DIETARY_PREFERENCES, MEALS } from '@nutritrack/shared';

export const DEFAULT_MEALS = [
  { id: 'breakfast', name: 'Breakfast', time: '08:00' },
  { id: 'lunch', name: 'Lunch', time: '13:00' },
  { id: 'dinner', name: 'Dinner', time: '19:00' },
  { id: 'snacks', name: 'Snacks', time: null },
] as const;

const milestoneSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 80 },
    type: { type: String, enum: ['streak_days', 'days_logged', 'target_weight'], required: true },
    target: { type: Number, required: true },
    achievedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'deleted'], default: 'active' },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },

    dateOfBirth: { type: String, default: null },
    sex: { type: String, enum: ['male', 'female', 'unspecified'], default: 'unspecified' },
    heightCm: { type: Number, default: null, min: 50, max: 272 },
    unitSystem: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
    timeZone: { type: String, default: 'UTC' },
    weekStartsOn: { type: Number, enum: [0, 1], default: 0 },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
    activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active', null], default: null },
    weightGoal: { type: String, enum: ['lose', 'maintain', 'gain', null], default: null },
    targetWeightKg: { type: Number, default: null },
    dietaryPreferences: { type: [{ type: String, enum: DIETARY_PREFERENCES }], default: [] },
    allergens: { type: [{ type: String, enum: ALLERGENS }], default: [] },
    excludedFoods: { type: [String], default: [] },
    meals: {
      type: [{ _id: false, id: { type: String, enum: MEALS }, name: String, time: { type: String, default: null } }],
      default: () => DEFAULT_MEALS.map((m) => ({ ...m })),
    },
    notifications: {
      mealReminders: { type: Boolean, default: false },
      hydrationReminders: { type: Boolean, default: false },
      goalProgress: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      hydrationIntervalHours: { type: Number, default: 2 },
    },
    milestones: { type: [milestoneSchema], default: [] },
    onboardingCompleted: { type: Boolean, default: false },
    profileUpdatedAt: { type: Date, default: () => new Date() },
    lastReminderAt: { type: Map, of: Date, default: {}, select: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'notifications.mealReminders': 1, 'notifications.hydrationReminders': 1 });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
