import { z } from 'zod';
import { isValidDateString, isValidTimeZone } from './dates';
import { MAX_SERVINGS, NUTRIENT_KEYS } from './nutrition';

/* ---------------------------------- primitives --------------------------------- */

export const dateStringSchema = z.string().refine(isValidDateString, { message: 'Expected a valid date (YYYY-MM-DD)' });
export const timeZoneSchema = z.string().max(64).refine(isValidTimeZone, { message: 'Unknown time zone' });
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');
export const requestIdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'Invalid request id');

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export const mealSchema = z.enum(MEALS);
export type Meal = z.infer<typeof mealSchema>;

export const PROVIDERS = ['nutritionix', 'usda', 'openfoodfacts', 'custom', 'recipe', 'fixture'] as const;
export const providerSchema = z.enum(PROVIDERS);
export type ProviderId = z.infer<typeof providerSchema>;
export const SEARCHABLE_PROVIDERS = ['nutritionix', 'usda', 'openfoodfacts', 'fixture'] as const;
export type SearchableProviderId = (typeof SEARCHABLE_PROVIDERS)[number];

export const foodIdSchema = z.string().min(1).max(200);
export const quantitySchema = z.number().positive('Quantity must be greater than 0').max(MAX_SERVINGS, `Quantity cannot exceed ${MAX_SERVINGS}`);

const nonNegative = (max: number) => z.number().min(0, 'Cannot be negative').max(max);
const optionalNutrient = (max: number) => nonNegative(max).nullable();

/* ------------------------------------ auth ------------------------------------- */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address').max(254));

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p), 'Use upper- and lower-case letters')
  .refine((p) => /\d/.test(p), 'Include at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: 'You must accept the terms and privacy policy' }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const tokenSchema = z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export const verifyEmailSchema = z.object({ token: tokenSchema });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

/* ----------------------------------- profile ----------------------------------- */

export const unitSystemSchema = z.enum(['metric', 'imperial']);
export const themeSchema = z.enum(['light', 'dark', 'system']);
export const activityLevelSchema = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const weightGoalSchema = z.enum(['lose', 'maintain', 'gain']);
export const sexSchema = z.enum(['male', 'female', 'unspecified']);

export const DIETARY_PREFERENCES = ['vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'dairy_free', 'halal', 'kosher', 'low_carb'] as const;
/** Allergen ids follow the Open Food Facts taxonomy (`en:<id>`), which is the only source with allergen tags. */
export const ALLERGENS = ['gluten', 'milk', 'eggs', 'nuts', 'peanuts', 'soybeans', 'fish', 'crustaceans', 'molluscs', 'sesame-seeds', 'celery', 'mustard', 'lupin', 'sulphur-dioxide-and-sulphites'] as const;

export const mealSettingSchema = z.object({
  id: mealSchema,
  name: z.string().trim().min(1).max(30),
  time: timeOfDaySchema.nullable(),
});

export const notificationPrefsSchema = z.object({
  mealReminders: z.boolean(),
  hydrationReminders: z.boolean(),
  goalProgress: z.boolean(),
  email: z.boolean(),
  hydrationIntervalHours: z.number().int().min(1).max(6),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    dateOfBirth: dateStringSchema.nullable(),
    sex: sexSchema,
    heightCm: z.number().min(50).max(272).nullable(),
    unitSystem: unitSystemSchema,
    timeZone: timeZoneSchema,
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    theme: themeSchema,
    activityLevel: activityLevelSchema.nullable(),
    weightGoal: weightGoalSchema.nullable(),
    targetWeightKg: z.number().min(20).max(400).nullable(),
    dietaryPreferences: z.array(z.enum(DIETARY_PREFERENCES)).max(DIETARY_PREFERENCES.length),
    allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
    excludedFoods: z.array(z.string().trim().min(1).max(40)).max(20),
    meals: z.array(mealSettingSchema).length(4),
    notifications: notificationPrefsSchema,
    onboardingCompleted: z.boolean(),
  })
  .partial()
  .strict();
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/* ------------------------------------ goals ------------------------------------ */

export const goalInputSchema = z.object({
  effectiveFrom: dateStringSchema.optional(),
  calories: z.number().int().min(800, 'Must be at least 800 kcal').max(10000),
  protein: nonNegative(1000),
  carbs: nonNegative(2000),
  fat: nonNegative(1000),
  fiber: optionalNutrient(200).optional(),
  waterMl: z.number().int().min(0).max(10000),
  source: z.enum(['manual', 'estimate']).optional(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;
export const goalUpdateSchema = goalInputSchema.partial().strict();

/* ------------------------------------ foods ------------------------------------ */

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(100),
  page: z.coerce.number().int().min(1).max(50).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(20),
  source: z.enum(['auto', ...SEARCHABLE_PROVIDERS]).default('auto'),
  type: z.enum(['all', 'branded', 'generic']).default('all'),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const barcodeSchema = z.string().regex(/^\d{6,14}$/, 'Barcodes contain 6–14 digits');

export const foodRefSchema = z.object({ provider: providerSchema, foodId: foodIdSchema });
export type FoodRef = z.infer<typeof foodRefSchema>;

export const nutrientInputSchema = z.object({
  calories: nonNegative(5000),
  protein: nonNegative(500),
  carbs: nonNegative(500),
  fat: nonNegative(500),
  saturatedFat: optionalNutrient(500),
  fiber: optionalNutrient(500),
  sugars: optionalNutrient(500),
  sodium: optionalNutrient(50000),
});

export const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).nullable(),
  servingLabel: z.string().trim().min(1).max(40),
  servingGrams: z.number().positive().max(5000).nullable(),
  nutrients: nutrientInputSchema,
});
export type CustomFoodInput = z.infer<typeof customFoodSchema>;

/* ------------------------------------ diary ------------------------------------ */

export const diaryEntryCreateSchema = z.object({
  date: dateStringSchema,
  meal: mealSchema,
  food: foodRefSchema,
  servingId: z.string().min(1).max(60),
  quantity: quantitySchema,
  notes: z.string().trim().max(300).nullable().optional(),
  clientRequestId: requestIdSchema,
});
export type DiaryEntryCreateInput = z.infer<typeof diaryEntryCreateSchema>;

export const diaryEntryUpdateSchema = z
  .object({
    date: dateStringSchema,
    meal: mealSchema,
    servingId: z.string().min(1).max(60),
    quantity: quantitySchema,
    notes: z.string().trim().max(300).nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type DiaryEntryUpdateInput = z.infer<typeof diaryEntryUpdateSchema>;

export const duplicateEntrySchema = z.object({
  date: dateStringSchema.optional(),
  meal: mealSchema.optional(),
  clientRequestId: requestIdSchema,
});

export const copyDaySchema = z
  .object({
    fromDate: dateStringSchema,
    toDate: dateStringSchema,
    entryIds: z.array(objectIdSchema).min(1).max(100).optional(),
    meals: z.array(mealSchema).min(1).max(4).optional(),
    clientRequestId: requestIdSchema,
  })
  .refine((v) => v.fromDate !== v.toDate, { message: 'Choose a different target date', path: ['toDate'] });
export type CopyDayInput = z.infer<typeof copyDaySchema>;

export const dateQuerySchema = z.object({ date: dateStringSchema });
export const rangeQuerySchema = z
  .object({ from: dateStringSchema, to: dateStringSchema })
  .refine((v) => v.from <= v.to, { message: '"from" must be on or before "to"', path: ['from'] });
export const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2200),
  month: z.coerce.number().int().min(1).max(12),
});

/* -------------------------- favorites / meals / recipes ------------------------- */

export const favoriteCreateSchema = z.object({ food: foodRefSchema });

export const templateItemSchema = z.object({
  food: foodRefSchema,
  servingId: z.string().min(1).max(60),
  quantity: quantitySchema,
});

export const savedMealSchema = z.object({
  name: z.string().trim().min(1).max(80),
  items: z.array(templateItemSchema).min(1).max(30),
});
export const savedMealUpdateSchema = savedMealSchema.partial().strict();

export const savedMealLogSchema = z.object({
  date: dateStringSchema,
  meal: mealSchema,
  quantities: z.array(quantitySchema).max(30).optional(),
  clientRequestId: requestIdSchema,
});

export const recipeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  portions: z.number().positive().max(100),
  notes: z.string().trim().max(1000).nullable().optional(),
  ingredients: z.array(templateItemSchema).min(1).max(50),
});
export const recipeUpdateSchema = recipeSchema.partial().strict();

/* -------------------------------- hydration/weight ------------------------------ */

export const hydrationCreateSchema = z.object({
  date: dateStringSchema,
  amountMl: z.number().positive().max(5000),
  clientRequestId: requestIdSchema.optional(),
});
export const hydrationUpdateSchema = z.object({ amountMl: z.number().positive().max(5000) });

export const weightCreateSchema = z.object({
  date: dateStringSchema,
  weightKg: z.number().min(20).max(400),
  note: z.string().trim().max(200).nullable().optional(),
});
export const weightUpdateSchema = z
  .object({ weightKg: z.number().min(20).max(400), note: z.string().trim().max(200).nullable() })
  .partial()
  .strict();
export const weightQuerySchema = z.object({ from: dateStringSchema.optional(), to: dateStringSchema.optional() });

/* --------------------------------- misc ---------------------------------------- */

export const notificationUpdateSchema = z.object({ read: z.boolean() });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(128), confirm: z.literal('DELETE') });

export const milestoneSchema = z.object({
  title: z.string().trim().min(1).max(80),
  type: z.enum(['streak_days', 'days_logged', 'target_weight']),
  target: z.number().positive().max(10000),
});

export { NUTRIENT_KEYS };
