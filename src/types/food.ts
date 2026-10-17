import type { Nutrition } from './nutrition';

export type PreparationState = 'raw' | 'cooked' | 'fried' | 'baked' | 'grilled' | 'steamed' | 'unknown';
export type NutritionDataQuality = 'complete' | 'partial' | 'unknown';

export type FoodMatch = {
  id: string;
  name: string;
  nutritionPer100g: Nutrition;
  source: string;
  sourceId?: string | null;
  barcode?: string | null;
  preparationState: PreparationState;
  dataQuality: NutritionDataQuality;
  verified: boolean;
};

export type Food = {
  id: number;
  name: string;
  normalizedName: string;
  nutritionPer100g: Nutrition;
  source: string;
  sourceId?: string | null;
  barcode?: string | null;
  preparationState: PreparationState;
  dataQuality: NutritionDataQuality;
  verified: boolean;
};

export type FoodDraft = {
  id?: number;
  name: string;
  grams: number;
  nutrition: Nutrition;
  nutritionPer100g?: Nutrition;
  confidence?: number;
  needsConfirmation: boolean;
  notes?: string | null;
  matches?: FoodMatch[];
  nutritionSource?: string | null;
  sourceId?: string | null;
  barcode?: string | null;
  preparationState?: PreparationState;
  dataQuality?: NutritionDataQuality;
  verified: boolean;
  estimationMethod: 'verified-food' | 'ai-estimate' | 'manual' | 'unknown';
};
