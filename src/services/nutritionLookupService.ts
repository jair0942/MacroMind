import { z } from 'zod';

import { config } from '@/src/constants/config';
import { findFood, normalizeFoodName, searchFoods } from '@/src/database/foodRepository';
import type { Food, FoodMatch, PreparationState } from '@/src/types/food';

const MatchSchema = z.object({
  id: z.string(), name: z.string(), nutritionPer100g: z.object({ calories: z.number(), protein: z.number(), carbohydrates: z.number(), fat: z.number(), fiber: z.number().nullable() }),
  source: z.enum(['usda', 'openfoodfacts']), sourceId: z.string().nullable(), barcode: z.string().nullable(),
  preparationState: z.enum(['raw', 'cooked', 'fried', 'baked', 'grilled', 'steamed', 'unknown']), dataQuality: z.enum(['complete', 'partial']), verified: z.boolean(),
});
const ResponseSchema = z.object({ matches: z.array(MatchSchema), source: z.enum(['usda', 'openfoodfacts']) });

const foodToMatch = (food: Food): FoodMatch => ({
  id: `local:${food.id}`, name: food.name, nutritionPer100g: food.nutritionPer100g, source: food.source,
  sourceId: food.sourceId, barcode: food.barcode, preparationState: food.preparationState, dataQuality: food.dataQuality, verified: food.verified,
});

const request = async (path: string): Promise<FoodMatch[]> => {
  if (!config.analysisApiUrl) throw new Error('Configura EXPO_PUBLIC_ANALYSIS_API_URL para consultar fuentes nutricionales externas.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${config.analysisApiUrl.replace(/\/$/, '')}${path}`, { signal: controller.signal });
    const payload = await response.json().catch(() => null) as { error?: unknown } | unknown;
    if (!response.ok) throw new Error(payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string' ? String((payload as { error: string }).error) : `La fuente nutricional respondió con ${response.status}.`);
    const parsed = ResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error('La respuesta de la fuente nutricional no es válida.');
    return parsed.data.matches;
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw new Error('La consulta nutricional tardó demasiado.');
    throw cause instanceof Error ? cause : new Error('No se pudo consultar la fuente nutricional.');
  } finally { clearTimeout(timeout); }
};

export const searchFoodCandidates = async (query: string, preparation?: PreparationState): Promise<FoodMatch[]> => {
  const local = await searchFoods(query);
  if (local.length > 0) return local.map(foodToMatch);
  if (config.demoMode) return [];
  const params = new URLSearchParams({ q: query });
  if (preparation && preparation !== 'unknown') params.set('preparation', preparation);
  return request(`/nutrition/search?${params.toString()}`);
};

export const lookupFoodBarcode = async (barcode: string): Promise<FoodMatch[]> => {
  const local = await searchFoods(barcode);
  if (local.length > 0) return local.map(foodToMatch);
  if (config.demoMode) return [];
  return request(`/nutrition/barcode/${encodeURIComponent(barcode)}`);
};

export const resolveRecognizedFood = async (name: string, preparation: PreparationState): Promise<{ selected?: FoodMatch; matches: FoodMatch[]; error?: string }> => {
  try {
    const local = await searchFoods(name);
    const exact = local.filter((food) => normalizeFoodName(food.name) === normalizeFoodName(name) && (preparation === 'unknown' || food.preparationState === preparation));
    if (exact.length === 1) return { selected: foodToMatch(exact[0]), matches: [] };
    if (local.length > 0) return { matches: local.map(foodToMatch) };
    if (config.demoMode) return { matches: [] };
    const external = await searchFoodCandidates(name, preparation);
    if (external.length === 1 && normalizeFoodName(external[0].name) === normalizeFoodName(name)) return { selected: external[0], matches: [] };
    return { matches: external };
  } catch (cause) {
    return { matches: [], error: cause instanceof Error ? cause.message : 'No se pudo consultar la fuente nutricional.' };
  }
};

export const findCachedFood = findFood;
