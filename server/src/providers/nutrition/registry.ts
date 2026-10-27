import type { SearchableProviderId } from '@nutritrack/shared';
import { FixtureProvider } from './fixture';
import { NutritionixProvider } from './nutritionix';
import { OpenFoodFactsProvider } from './openFoodFacts';
import { UsdaProvider } from './usda';
import type { NutritionProvider } from './types';

/**
 * Priority order for automatic selection and fallback:
 *   fixture (tests only) -> Nutritionix (branded + common, needs approved keys)
 *   -> USDA FoodData Central (generic + branded, free key) -> Open Food Facts (packaged, keyless).
 */
let providers: NutritionProvider[] | undefined;

export function allProviders(): NutritionProvider[] {
  providers ??= [new FixtureProvider(), new NutritionixProvider(), new UsdaProvider(), new OpenFoodFactsProvider()];
  return providers;
}

export function configuredProviders(): NutritionProvider[] {
  return allProviders().filter((p) => p.isConfigured());
}

export function getProvider(id: string): NutritionProvider | undefined {
  return allProviders().find((p) => p.id === id);
}

export function primaryProviderId(): SearchableProviderId | null {
  return configuredProviders()[0]?.id ?? null;
}

/** Test hook: swap provider implementations. */
export function setProvidersForTesting(list: NutritionProvider[] | undefined) {
  providers = list;
}
