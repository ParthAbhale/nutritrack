/**
 * TEST FIXTURES ONLY. These are synthetic records used by automated tests and
 * the E2E suite (ENABLE_FIXTURE_PROVIDER=true, never in production). Brands are
 * deliberately fictional ("Fixture Foods") so they cannot be mistaken for real
 * product data, and every record is attributed as test data in the UI.
 */
export interface FixtureFood {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kind: 'branded' | 'generic';
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number | null; sugars: number | null; sodium: number | null };
  servingGrams: number | null;
  servingLabel: string | null;
  allergens: string[] | null;
}

export const FIXTURE_FOODS: FixtureFood[] = [
  { id: 'fx-pb-creamy', name: 'Creamy Peanut Butter', brand: 'Fixture Foods A', barcode: '00000000000017', kind: 'branded',
    per100g: { calories: 600, protein: 25, carbs: 20, fat: 50, fiber: 6, sugars: 9, sodium: 400 }, servingGrams: 32, servingLabel: '2 tbsp', allergens: ['peanuts'] },
  { id: 'fx-pb-crunchy', name: 'Crunchy Peanut Butter', brand: 'Fixture Foods A', barcode: '00000000000024', kind: 'branded',
    per100g: { calories: 590, protein: 24, carbs: 21, fat: 49, fiber: 7, sugars: 8, sodium: 380 }, servingGrams: 32, servingLabel: '2 tbsp', allergens: ['peanuts'] },
  { id: 'fx-pb-natural', name: 'Natural Unsweetened Peanut Butter', brand: 'Fixture Foods B', barcode: null, kind: 'branded',
    per100g: { calories: 610, protein: 26, carbs: 16, fat: 52, fiber: 8, sugars: 4, sodium: null }, servingGrams: 30, servingLabel: '2 tbsp', allergens: null },
  { id: 'fx-pb-generic', name: 'Peanut butter, smooth style', brand: null, barcode: null, kind: 'generic',
    per100g: { calories: 597, protein: 22, carbs: 22, fat: 51, fiber: 5, sugars: 9, sodium: 430 }, servingGrams: null, servingLabel: null, allergens: null },
  { id: 'fx-rice-white', name: 'White rice, cooked', brand: null, barcode: null, kind: 'generic',
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugars: 0.1, sodium: 1 }, servingGrams: null, servingLabel: null, allergens: null },
  { id: 'fx-rice-brown', name: 'Brown rice, cooked', brand: null, barcode: null, kind: 'generic',
    per100g: { calories: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6, sugars: 0.4, sodium: 4 }, servingGrams: null, servingLabel: null, allergens: null },
  { id: 'fx-rice-basmati', name: 'Basmati Rice, raw', brand: 'Fixture Foods C', barcode: '00000000000031', kind: 'branded',
    per100g: { calories: 350, protein: 8, carbs: 78, fat: 0.6, fiber: null, sugars: null, sodium: null }, servingGrams: 45, servingLabel: '1/4 cup dry', allergens: [] },
];

/** Food-specific portions for generic fixtures (like USDA foodPortions). */
export const FIXTURE_PORTIONS: Record<string, { label: string; grams: number }[]> = {
  'fx-rice-white': [{ label: '1 cup', grams: 158 }],
  'fx-rice-brown': [{ label: '1 cup', grams: 195 }],
  'fx-pb-generic': [{ label: '1 tbsp', grams: 16 }],
};
