import type { FoodDraft } from './food';
import type { Nutrition } from './nutrition';

export type MealType = 'desayuno' | 'comida' | 'cena' | 'snack';
export type AnalysisStatus = 'manual' | 'pending' | 'analyzed' | 'confirmed' | 'error';

export type Meal = {
  id: number;
  recordedAt: string;
  mealType: MealType;
  imageUri?: string | null;
  notes?: string | null;
  analysisStatus: AnalysisStatus;
  items: FoodDraft[];
  totals: Nutrition;
};

export type MealInput = {
  recordedAt: string;
  mealType: MealType;
  imageUri?: string | null;
  notes?: string | null;
  analysisStatus: AnalysisStatus;
  items: FoodDraft[];
};
