import { z } from 'zod';

export const PreparationStateSchema = z.enum(['raw', 'cooked', 'fried', 'baked', 'grilled', 'steamed', 'unknown']);
export const NutritionMatchSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  nutritionPer100g: z.object({
    calories: z.number().finite().min(0), protein: z.number().finite().min(0), carbohydrates: z.number().finite().min(0),
    fat: z.number().finite().min(0), fiber: z.number().finite().min(0).nullable(),
  }),
  source: z.enum(['usda', 'openfoodfacts']),
  sourceId: z.string().nullable(), barcode: z.string().nullable(),
  preparationState: PreparationStateSchema,
  dataQuality: z.enum(['complete', 'partial']),
  verified: z.boolean(),
});

export const NutritionSearchResponseSchema = z.object({
  matches: z.array(NutritionMatchSchema).max(20),
  source: z.enum(['usda', 'openfoodfacts']),
});

export type NutritionMatch = z.infer<typeof NutritionMatchSchema>;
