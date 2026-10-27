import type {
  DiaryEntry, FoodItem, GoalSnapshot, NutrientValues, UserProfile, CustomFood as CustomFoodDto, TemplateItem,
} from '@nutritrack/shared';
import { NUTRIENT_KEYS, emptyNutrients } from '@nutritrack/shared';

/* Lean Mongoose documents are loosely typed; these functions are the single
 * place where persistence shapes become API contract shapes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Lean = any;

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

export function toNutrients(raw: Lean): NutrientValues {
  const out = emptyNutrients();
  for (const k of NUTRIENT_KEYS) {
    const v = raw?.[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  return out;
}

export function toFoodItem(raw: Lean): FoodItem {
  return {
    provider: raw.provider,
    providerFoodId: raw.providerFoodId,
    name: raw.name,
    brand: raw.brand ?? null,
    barcode: raw.barcode ?? null,
    imageUrl: raw.imageUrl ?? null,
    category: raw.category ?? null,
    kind: raw.kind,
    basis: raw.basis?.type === 'perServing' ? { type: 'perServing', servingGrams: raw.basis.servingGrams ?? null } : { type: raw.basis.type },
    nutrients: toNutrients(raw.nutrients),
    servings: (raw.servings ?? []).map((s: Lean) => ({
      id: s.id,
      label: s.label,
      grams: s.grams ?? null,
      ...(s.isBasisServing ? { isBasisServing: true } : {}),
    })),
    defaultServingId: raw.defaultServingId,
    completeness: raw.completeness,
    detailed: raw.detailed ?? true,
    ingredientsText: raw.ingredientsText ?? null,
    allergens: Array.isArray(raw.allergens) ? raw.allergens : null,
    attribution: raw.attribution,
    sourceUrl: raw.sourceUrl ?? null,
    fetchedAt: iso(raw.fetchedAt),
  };
}

/** Shape for persisting a FoodItem as a snapshot sub-document. */
export function toSnapshot(food: FoodItem) {
  return { ...food, fetchedAt: new Date(food.fetchedAt) };
}

export function toDiaryEntry(doc: Lean): DiaryEntry {
  return {
    id: String(doc._id),
    date: doc.date,
    meal: doc.meal,
    food: toFoodItem(doc.food),
    servingId: doc.servingId,
    servingLabel: doc.servingLabel,
    quantity: doc.quantity,
    consumedGrams: doc.consumedGrams ?? null,
    nutrients: toNutrients(doc.nutrients),
    notes: doc.notes ?? null,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toGoal(doc: Lean): GoalSnapshot {
  return {
    id: String(doc._id),
    effectiveFrom: doc.effectiveFrom,
    calories: doc.calories,
    protein: doc.protein,
    carbs: doc.carbs,
    fat: doc.fat,
    fiber: doc.fiber ?? null,
    waterMl: doc.waterMl,
    source: doc.source ?? 'manual',
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toUserProfile(doc: Lean): UserProfile {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    emailVerified: Boolean(doc.emailVerifiedAt),
    dateOfBirth: doc.dateOfBirth ?? null,
    sex: doc.sex ?? 'unspecified',
    heightCm: doc.heightCm ?? null,
    unitSystem: doc.unitSystem,
    timeZone: doc.timeZone,
    weekStartsOn: doc.weekStartsOn === 1 ? 1 : 0,
    theme: doc.theme,
    activityLevel: doc.activityLevel ?? null,
    weightGoal: doc.weightGoal ?? null,
    targetWeightKg: doc.targetWeightKg ?? null,
    dietaryPreferences: doc.dietaryPreferences ?? [],
    allergens: doc.allergens ?? [],
    excludedFoods: doc.excludedFoods ?? [],
    meals: (doc.meals ?? []).map((m: Lean) => ({ id: m.id, name: m.name, time: m.time ?? null })),
    notifications: {
      mealReminders: Boolean(doc.notifications?.mealReminders),
      hydrationReminders: Boolean(doc.notifications?.hydrationReminders),
      goalProgress: doc.notifications?.goalProgress !== false,
      email: Boolean(doc.notifications?.email),
      hydrationIntervalHours: doc.notifications?.hydrationIntervalHours ?? 2,
    },
    milestones: (doc.milestones ?? []).map((m: Lean) => ({
      id: String(m._id),
      title: m.title,
      type: m.type,
      target: m.target,
      achievedAt: m.achievedAt ? iso(m.achievedAt) : null,
      createdAt: iso(m.createdAt),
    })),
    onboardingCompleted: Boolean(doc.onboardingCompleted),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    profileUpdatedAt: iso(doc.profileUpdatedAt ?? doc.updatedAt),
  };
}

export function toCustomFood(doc: Lean): CustomFoodDto {
  return {
    id: String(doc._id),
    name: doc.name,
    brand: doc.brand ?? null,
    servingLabel: doc.servingLabel,
    servingGrams: doc.servingGrams ?? null,
    nutrients: toNutrients(doc.nutrients),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toTemplateItem(raw: Lean): TemplateItem {
  return {
    food: toFoodItem(raw.food),
    servingId: raw.servingId,
    servingLabel: raw.servingLabel,
    quantity: raw.quantity,
    grams: raw.grams ?? null,
    nutrients: toNutrients(raw.nutrients),
  };
}

export { iso };
