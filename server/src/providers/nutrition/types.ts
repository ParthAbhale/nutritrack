import type { FoodItem, SearchableProviderId } from '@nutritrack/shared';

export interface ProviderSearchOptions {
  page: number;
  pageSize: number;
  type: 'all' | 'branded' | 'generic';
  signal?: AbortSignal;
}

export interface ProviderSearchPage {
  items: FoodItem[];
  total: number | null;
  hasMore: boolean;
}

/**
 * Adapter contract for external nutrition sources. Implementations must
 * validate upstream responses, map them to FoodItem, keep unknown nutrients as
 * null, and throw UpstreamError on transport failures (never fabricate data).
 */
export interface NutritionProvider {
  readonly id: SearchableProviderId;
  readonly label: string;
  readonly supportsBarcode: boolean;
  isConfigured(): boolean;
  search(query: string, opts: ProviderSearchOptions): Promise<ProviderSearchPage>;
  getFood(foodId: string, signal?: AbortSignal): Promise<FoodItem | null>;
  lookupBarcode?(barcode: string, signal?: AbortSignal): Promise<FoodItem | null>;
}
