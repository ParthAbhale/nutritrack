/**
 * Energy-need ESTIMATES used to suggest starting goals during onboarding.
 * These are population formulas (Mifflin-St Jeor) and are only approximations;
 * users always confirm or edit the suggested targets. The estimator never
 * suggests intake below a conservative floor or a deficit larger than 500 kcal.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoal = 'lose' | 'maintain' | 'gain';
export type EstimateSex = 'male' | 'female' | 'unspecified';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Lightly active (1–3 days/week)',
  moderate: 'Moderately active (3–5 days/week)',
  active: 'Active (6–7 days/week)',
  very_active: 'Very active (physical job or twice-daily training)',
};

export const MIN_SUGGESTED_CALORIES = 1500;
export const MAX_GOAL_ADJUSTMENT = 500;

export interface EnergyEstimateInput {
  weightKg: number;
  heightCm: number;
  ageYears: number | null;
  sex: EstimateSex;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
}

export interface EnergyEstimate {
  bmr: number;
  maintenanceCalories: number;
  suggestedCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  notes: string[];
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function estimateEnergyNeeds(input: EnergyEstimateInput): EnergyEstimate {
  const notes: string[] = [];
  const age = input.ageYears ?? 30;
  if (input.ageYears === null) notes.push('Age not provided; an age of 30 was assumed for the estimate.');
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age;
  const sexOffset = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78;
  if (input.sex === 'unspecified') notes.push('Sex not specified; the average of both formula variants was used.');
  const bmr = base + sexOffset;
  const maintenance = bmr * ACTIVITY_FACTORS[input.activityLevel];

  let suggested = maintenance;
  if (input.goal === 'lose') suggested = maintenance - Math.min(MAX_GOAL_ADJUSTMENT, maintenance * 0.15);
  if (input.goal === 'gain') suggested = maintenance + Math.min(300, maintenance * 0.1);
  if (suggested < MIN_SUGGESTED_CALORIES) {
    suggested = Math.max(MIN_SUGGESTED_CALORIES, Math.min(maintenance, MIN_SUGGESTED_CALORIES));
    notes.push(`Suggestion kept at or above ${MIN_SUGGESTED_CALORIES} kcal. Consult a professional for lower targets.`);
  }
  suggested = roundTo(suggested, 10);

  // Protein ~1.6 g/kg (capped at 35% of energy), fat 30% of energy, carbs the remainder.
  const protein = Math.min(1.6 * input.weightKg, (suggested * 0.35) / 4);
  const fat = (suggested * 0.3) / 9;
  const carbs = Math.max(0, (suggested - protein * 4 - fat * 9) / 4);

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: roundTo(maintenance, 10),
    suggestedCalories: suggested,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    waterMl: roundTo(Math.min(4000, Math.max(1500, 35 * input.weightKg)), 50),
    notes,
  };
}

export function ageFromDateOfBirth(dob: string, today: string): number | null {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FL_OZ = 29.5735295625;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;
