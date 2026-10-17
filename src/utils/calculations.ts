import type { Nutrition } from '@/src/types/nutrition';
import type { FoodDraft } from '@/src/types/food';
import type { ActivityLevel, GoalType, PhysiologicalSex } from '@/src/types/profile';

export const calculateNutrition = (grams: number, per100g: Nutrition): Nutrition => {
  const factor = Math.max(0, grams) / 100;
  const round = (value: number): number => Math.round(value * 1000) / 1000;
  return {
    calories: round(per100g.calories * factor),
    protein: round(per100g.protein * factor),
    carbohydrates: round(per100g.carbohydrates * factor),
    fat: round(per100g.fat * factor),
    fiber: per100g.fiber == null ? null : round(per100g.fiber * factor),
  };
};

export const sumNutrition = (items: (Nutrition | undefined)[]): Nutrition =>
  items.reduce<Nutrition>(
    (total, item) => ({
      calories: total.calories + (item?.calories ?? 0),
      protein: total.protein + (item?.protein ?? 0),
      carbohydrates: total.carbohydrates + (item?.carbohydrates ?? 0),
      fat: total.fat + (item?.fat ?? 0),
      fiber: (total.fiber ?? 0) + (item?.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: 0 },
  );

export const totalDraftNutrition = (items: FoodDraft[]): Nutrition => sumNutrition(items.map((item) => item.nutrition));

export const estimateBmr = (weightKg: number, heightCm: number, age: number, sex: PhysiologicalSex): number | null => {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0 || sex === 'unspecified') return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
};

export const estimateDailyEnergy = (bmr: number, activity: ActivityLevel): number => {
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725,
    extremely_active: 1.9,
  };
  return Math.round(bmr * multipliers[activity]);
};

export const proposeCalorieGoal = (tdee: number, goal: GoalType): number => {
  const adjustment = goal === 'fat_loss' ? -350 : goal === 'muscle_gain' ? 200 : goal === 'recomposition' ? -100 : 0;
  return Math.max(1200, Math.round(tdee + adjustment));
};

export const distributeMacros = (calories: number, weightKg: number, goal: GoalType): Nutrition => {
  const protein = Math.round(Math.max(1.4, goal === 'muscle_gain' ? 1.8 : 1.6) * weightKg);
  const fat = Math.round((calories * 0.28) / 9);
  const carbohydrates = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbohydrates, fat, fiber: null };
};

export const ratio = (value: number, goal: number): number => (goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0);
