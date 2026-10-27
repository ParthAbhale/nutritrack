/**
 * Response contracts for /api/v1. Every success response is `{ data: T }`
 * (plus `meta` for paginated lists); every error is `{ error: ApiErrorBody }`.
 */
import type { DateString } from './dates';
import type { NutrientBasis, NutrientTotals, NutrientValues, ServingOption, GoalProgress } from './nutrition';
import type { Meal, ProviderId, SearchableProviderId } from './schemas';
import type { ActivityLevel, EstimateSex, WeightGoal } from './energy';

export interface ApiSuccess<T, M = undefined> {
  data: T;
  meta?: M;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'CSRF_INVALID'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'EMAIL_NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: { path: string; message: string }[];
  requestId?: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number | null;
  hasMore: boolean;
}

/* ------------------------------------ users ------------------------------------ */

export interface MealSetting {
  id: Meal;
  name: string;
  time: string | null;
}

export interface NotificationPrefs {
  mealReminders: boolean;
  hydrationReminders: boolean;
  goalProgress: boolean;
  email: boolean;
  hydrationIntervalHours: number;
}

export interface Milestone {
  id: string;
  title: string;
  type: 'streak_days' | 'days_logged' | 'target_weight';
  target: number;
  achievedAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  dateOfBirth: DateString | null;
  sex: EstimateSex;
  heightCm: number | null;
  unitSystem: 'metric' | 'imperial';
  timeZone: string;
  weekStartsOn: 0 | 1;
  theme: 'light' | 'dark' | 'system';
  activityLevel: ActivityLevel | null;
  weightGoal: WeightGoal | null;
  targetWeightKg: number | null;
  dietaryPreferences: string[];
  allergens: string[];
  excludedFoods: string[];
  meals: MealSetting[];
  notifications: NotificationPrefs;
  milestones: Milestone[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  profileUpdatedAt: string;
}

export interface AuthPayload {
  user: UserProfile;
  csrfToken: string;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface ServerCapabilities {
  emailDelivery: boolean;
  providers: { id: SearchableProviderId; label: string; configured: boolean; barcode: boolean }[];
  primaryProvider: SearchableProviderId | null;
}

/* ------------------------------------ foods ------------------------------------ */

export interface FoodItem {
  provider: ProviderId;
  providerFoodId: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string | null;
  category: string | null;
  /** 'branded' | 'generic' | 'custom' | 'recipe' */
  kind: 'branded' | 'generic' | 'custom' | 'recipe';
  basis: NutrientBasis;
  /** Values expressed in `basis`. null = not reported by the source. */
  nutrients: NutrientValues;
  servings: ServingOption[];
  defaultServingId: string;
  completeness: 'complete' | 'partial' | 'unknown';
  /** When false, serving options are search-level only; fetch details for more. */
  detailed: boolean;
  ingredientsText: string | null;
  /** Allergen tag ids (no prefix). null = the source does not provide allergen data. */
  allergens: string[] | null;
  attribution: string;
  sourceUrl: string | null;
  fetchedAt: string;
}

export interface FoodSearchResult {
  items: FoodItem[];
  provider: SearchableProviderId;
  warnings: string[];
}

export interface SearchHistoryItem {
  query: string;
  lastUsedAt: string;
}

export interface Favorite {
  id: string;
  food: FoodItem;
  createdAt: string;
}

export interface RecentFood {
  food: FoodItem;
  lastServingId: string;
  lastQuantity: number;
  lastMeal: Meal;
  lastLoggedAt: string;
  timesLogged: number;
}

export interface CustomFood {
  id: string;
  name: string;
  brand: string | null;
  servingLabel: string;
  servingGrams: number | null;
  nutrients: NutrientValues;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------ diary ------------------------------------ */

export interface DiaryEntry {
  id: string;
  date: DateString;
  meal: Meal;
  food: FoodItem;
  servingId: string;
  servingLabel: string;
  quantity: number;
  consumedGrams: number | null;
  nutrients: NutrientValues;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealSummary {
  meal: Meal;
  name: string;
  totals: NutrientTotals;
  entries: DiaryEntry[];
}

export interface GoalSnapshot {
  id: string;
  effectiveFrom: DateString;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  waterMl: number;
  source: 'manual' | 'estimate';
  createdAt: string;
  updatedAt: string;
}

export interface DayProgress {
  calories: GoalProgress;
  protein: GoalProgress;
  carbs: GoalProgress;
  fat: GoalProgress;
  water: GoalProgress;
}

export interface DailySummary {
  date: DateString;
  logged: boolean;
  totals: NutrientTotals;
  meals: MealSummary[];
  waterMl: number;
  goal: GoalSnapshot | null;
  progress: DayProgress;
  macroCalories: { protein: number | null; carbs: number | null; fat: number | null; total: number };
}

export interface CalendarDay {
  date: DateString;
  logged: boolean;
  entryCount: number;
  calories: number | null;
  calorieTarget: number | null;
  status: GoalProgress['status'] | 'not-logged';
  waterMl: number;
}

export interface PeriodStats {
  from: DateString;
  to: DateString;
  daysInPeriod: number;
  /** Days up to and including today (future days are not counted as missed). */
  elapsedDays: number;
  daysLogged: number;
  daysMeetingCalorieGoal: number;
  totals: NutrientTotals;
  averages: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
  highestDay: { date: DateString; calories: number } | null;
  lowestDay: { date: DateString; calories: number } | null;
  /** daysLogged / elapsedDays, 0-100 */
  consistencyPercent: number | null;
  waterTotalMl: number;
  averageWaterMl: number | null;
}

export interface MonthlyCalendar {
  year: number;
  month: number;
  days: CalendarDay[];
  stats: PeriodStats;
}

export interface RangeDay {
  date: DateString;
  logged: boolean;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  waterMl: number;
  weightKg: number | null;
  calorieTarget: number | null;
  status: CalendarDay['status'];
}

export interface RangeAnalytics {
  stats: PeriodStats;
  days: RangeDay[];
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastLoggedDate: DateString | null;
  /** True when today isn't logged yet but yesterday was, so the streak is still alive. */
  pendingToday: boolean;
  last7DaysLogged: number;
}

export interface ActivityItem {
  id: string;
  type: 'food_logged' | 'goal_changed' | 'weight_logged' | 'water_logged' | 'recipe_saved';
  message: string;
  date: DateString | null;
  createdAt: string;
}

/* ------------------------------- other resources -------------------------------- */

export interface TemplateItem {
  food: FoodItem;
  servingId: string;
  servingLabel: string;
  quantity: number;
  grams: number | null;
  nutrients: NutrientValues;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: TemplateItem[];
  totals: NutrientTotals;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  portions: number;
  notes: string | null;
  ingredients: TemplateItem[];
  totals: NutrientTotals;
  perPortion: NutrientValues;
  gramsPerPortion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationLog {
  id: string;
  date: DateString;
  amountMl: number;
  loggedAt: string;
}

export interface HydrationDay {
  date: DateString;
  totalMl: number;
  goalMl: number | null;
  logs: HydrationLog[];
}

export interface WeightLog {
  id: string;
  date: DateString;
  weightKg: number;
  note: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: 'meal_reminder' | 'hydration_reminder' | 'goal_reached' | 'goal_exceeded' | 'milestone' | 'system';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface EnergyEstimateResponse {
  bmr: number;
  maintenanceCalories: number;
  suggestedCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  notes: string[];
}
