import type { FoodDraft } from '@/src/types/food';
import type { Nutrition } from '@/src/types/nutrition';
import { calculateNutrition, sumNutrition } from '@/src/utils/calculations';

export const nutritionForGrams = (grams: number, per100g: Nutrition): Nutrition => calculateNutrition(grams, per100g);
export const nutritionForItems = (items: FoodDraft[]): Nutrition => sumNutrition(items.map((item) => item.nutrition));
