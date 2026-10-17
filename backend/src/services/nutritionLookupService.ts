import { NutritionMatchSchema, type NutritionMatch, PreparationStateSchema } from '../schemas/nutrition.js';

const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';
// v2 exposes the product nutriments used below. The v3.6 response can return
// the product shell without the nutriments object for the same barcode.
const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 100;
const nutritionCache = new Map<string, { expiresAt: number; matches: NutritionMatch[] }>();

export class NutritionLookupError extends Error {
  constructor(public readonly statusCode: 429 | 502 | 503 | 504, message: string) {
    super(message);
    this.name = 'NutritionLookupError';
  }
}

const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const inferPreparation = (text: string): NutritionMatch['preparationState'] => {
  const value = text.toLocaleLowerCase('en');
  if (/\b(raw|uncooked|fresh)\b/.test(value)) return 'raw';
  if (/\b(fried|deep[- ]fried)\b/.test(value)) return 'fried';
  if (/\b(baked|roasted)\b/.test(value)) return 'baked';
  if (/\b(grilled|broiled)\b/.test(value)) return 'grilled';
  if (/\b(steamed)\b/.test(value)) return 'steamed';
  if (/\b(cooked|boiled|prepared)\b/.test(value)) return 'cooked';
  return 'unknown';
};

const nutrientValue = (nutrients: unknown[], ids: string[], names: string[]): number | null => {
  for (const entry of nutrients) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const nutrientNumber = String(record.nutrientNumber ?? record.nutrientId ?? '');
    const name = String(record.nutrientName ?? record.name ?? '').toLocaleLowerCase('en');
    if (ids.includes(nutrientNumber) || names.some((candidate) => name.includes(candidate))) {
      const value = numberOrNull(record.value);
      if (value !== null) return value;
    }
  }
  return null;
};

const parseUsdaMatch = (food: unknown): NutritionMatch | null => {
  if (!food || typeof food !== 'object') return null;
  const record = food as Record<string, unknown>;
  const nutrients = Array.isArray(record.foodNutrients) ? record.foodNutrients : [];
  const calories = nutrientValue(nutrients, ['1008', '208'], ['energy']);
  const protein = nutrientValue(nutrients, ['1003'], ['protein']);
  const carbohydrates = nutrientValue(nutrients, ['1005'], ['carbohydrate']);
  const fat = nutrientValue(nutrients, ['1004'], ['total lipid', 'total fat']);
  if (calories === null || protein === null || carbohydrates === null || fat === null) return null;
  const description = String(record.description ?? '').trim();
  if (!description) return null;
  const fdcId = String(record.fdcId ?? '');
  if (!fdcId) return null;
  const fiber = nutrientValue(nutrients, ['1079'], ['fiber']);
  const preparationState = PreparationStateSchema.parse(inferPreparation(description));
  return NutritionMatchSchema.parse({
    id: `usda:${fdcId}`, name: description, nutritionPer100g: { calories, protein, carbohydrates, fat, fiber }, source: 'usda', sourceId: fdcId,
    barcode: null, preparationState, dataQuality: 'complete', verified: true,
  });
};

const requestJson = async (url: string, headers: Record<string, string> = {}): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (response.status === 429) throw new NutritionLookupError(429, 'La fuente nutricional ha alcanzado su límite temporal.');
    if (response.status === 401 || response.status === 403) throw new NutritionLookupError(503, 'La fuente nutricional rechazó las credenciales configuradas.');
    if (!response.ok) throw new NutritionLookupError(502, `La fuente nutricional respondió con HTTP ${response.status}.`);
    return await response.json();
  } catch (cause) {
    if (cause instanceof NutritionLookupError) throw cause;
    if (cause instanceof Error && cause.name === 'AbortError') throw new NutritionLookupError(504, 'La consulta nutricional tardó demasiado.');
    throw new NutritionLookupError(502, 'No se pudo consultar la fuente nutricional.');
  } finally {
    clearTimeout(timeout);
  }
};

const getCached = (key: string): NutritionMatch[] | undefined => {
  const cached = nutritionCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) { nutritionCache.delete(key); return undefined; }
  return cached.matches;
};

const setCached = (key: string, matches: NutritionMatch[]): void => {
  if (nutritionCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = nutritionCache.keys().next().value;
    if (oldestKey) nutritionCache.delete(oldestKey);
  }
  nutritionCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, matches });
};

export const searchUsda = async (query: string, preparation?: NutritionMatch['preparationState']): Promise<NutritionMatch[]> => {
  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey || apiKey === 'example-only') throw new NutritionLookupError(503, 'USDA_API_KEY no está configurada en el backend.');
  const cacheKey = `usda:${query.trim().toLocaleLowerCase('en')}:${preparation ?? 'unknown'}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const params = new URLSearchParams({ api_key: apiKey, query, pageSize: '10', dataType: 'Foundation,SR Legacy,FNDDS,Branded' });
  const body = await requestJson(`${USDA_ENDPOINT}?${params.toString()}`);
  const foods = body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).foods) ? (body as { foods: unknown[] }).foods : [];
  const matches = foods.map(parseUsdaMatch).filter((match): match is NutritionMatch => match !== null);
  const ordered = !preparation || preparation === 'unknown' ? matches : [...matches.filter((match) => match.preparationState === preparation), ...matches.filter((match) => match.preparationState !== preparation)];
  setCached(cacheKey, ordered);
  return ordered;
};

export const lookupOpenFoodFactsBarcode = async (barcode: string): Promise<NutritionMatch[]> => {
  const normalizedBarcode = barcode.replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(normalizedBarcode)) return [];
  const cacheKey = `openfoodfacts:${normalizedBarcode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const body = await requestJson(`${OFF_ENDPOINT}/${normalizedBarcode}.json`, { 'User-Agent': process.env.OPENFOODFACTS_USER_AGENT?.trim() || 'MacroMind/1.0 (personal nutrition app)' });
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).status !== 1) return [];
  const product = (body as Record<string, unknown>).product;
  if (!product || typeof product !== 'object') return [];
  const record = product as Record<string, unknown>;
  const nutriments = record.nutriments && typeof record.nutriments === 'object' ? record.nutriments as Record<string, unknown> : {};
  const energyKcal = numberOrNull(nutriments['energy-kcal_100g']) ?? (() => { const kj = numberOrNull(nutriments['energy_100g']); return kj === null ? null : kj / 4.184; })();
  const protein = numberOrNull(nutriments['proteins_100g']);
  const carbohydrates = numberOrNull(nutriments['carbohydrates_100g']);
  const fat = numberOrNull(nutriments['fat_100g']);
  if (energyKcal === null || protein === null || carbohydrates === null || fat === null) return [];
  const name = String(record.product_name ?? record.product_name_en ?? '').trim();
  if (!name) return [];
  const fiber = numberOrNull(nutriments['fiber_100g']);
  const matches = [NutritionMatchSchema.parse({ id: `openfoodfacts:${normalizedBarcode}`, name, nutritionPer100g: { calories: energyKcal, protein, carbohydrates, fat, fiber }, source: 'openfoodfacts', sourceId: normalizedBarcode, barcode: normalizedBarcode, preparationState: 'unknown', dataQuality: 'complete', verified: true })];
  setCached(cacheKey, matches);
  return matches;
};
