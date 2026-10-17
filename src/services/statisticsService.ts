import { getGoal } from '@/src/database/profileRepository';
import { getMealsBetween } from '@/src/database/mealRepository';
import { listWeightEntries, type WeightEntry } from '@/src/database/weightRepository';
import type { Meal } from '@/src/types/meal';
import type { DailyGoal } from '@/src/types/nutrition';
import { dateRange, localDateKey } from '@/src/utils/dates';

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';
export type DailyStat = { date: string; calories: number; protein: number; carbohydrates: number; fat: number; goal: DailyGoal; mealCount: number; hasRecords: boolean };
export type FoodFrequency = { name: string; count: number; grams: number };
export type Statistics = {
  startDate: string;
  endDate: string;
  days: DailyStat[];
  meals: Meal[];
  weights: WeightEntry[];
  caloriesConsumed: number;
  caloriesGoal: number;
  averageCalories: number | null;
  averageProtein: number | null;
  averageCarbohydrates: number | null;
  averageFat: number | null;
  reachedGoalDays: number;
  registeredDays: number;
  averageCaloriesPerMeal: number | null;
  initialWeight: number | null;
  latestWeight: number | null;
  weightChange: number | null;
  foodFrequency: FoodFrequency[];
};

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const average = (values: number[]): number | null => values.length ? sum(values) / values.length : null;

export const buildStatistics = async (startDate: string, endDate: string): Promise<Statistics> => {
  const [meals, weights] = await Promise.all([getMealsBetween(startDate, endDate), listWeightEntries(startDate, endDate)]);
  const dates = dateRange(startDate, endDate);
  const mealsByDay = new Map<string, Meal[]>();
  for (const meal of meals) {
    const key = localDateKey(new Date(meal.recordedAt));
    mealsByDay.set(key, [...(mealsByDay.get(key) ?? []), meal]);
  }
  const days: DailyStat[] = [];
  for (const date of dates) {
    const dayMeals = mealsByDay.get(date) ?? [];
    const goal = await getGoal(date);
    days.push({
      date,
      calories: sum(dayMeals.map((meal) => meal.totals.calories)),
      protein: sum(dayMeals.map((meal) => meal.totals.protein)),
      carbohydrates: sum(dayMeals.map((meal) => meal.totals.carbohydrates)),
      fat: sum(dayMeals.map((meal) => meal.totals.fat)),
      goal,
      mealCount: dayMeals.length,
      hasRecords: dayMeals.length > 0,
    });
  }
  const registeredDays = days.filter((day) => day.hasRecords);
  const foodMap = new Map<string, FoodFrequency>();
  for (const meal of meals) for (const item of meal.items) {
    const key = item.name.trim().toLocaleLowerCase('es');
    const current = foodMap.get(key) ?? { name: item.name.trim(), count: 0, grams: 0 };
    current.count += 1;
    current.grams += item.grams;
    foodMap.set(key, current);
  }
  const weightsSorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const calorieValues = registeredDays.map((day) => day.calories);
  return {
    startDate, endDate, days, meals, weights,
    caloriesConsumed: sum(days.map((day) => day.calories)),
    caloriesGoal: sum(days.map((day) => day.goal.calories)),
    averageCalories: average(calorieValues),
    averageProtein: average(registeredDays.map((day) => day.protein)),
    averageCarbohydrates: average(registeredDays.map((day) => day.carbohydrates)),
    averageFat: average(registeredDays.map((day) => day.fat)),
    reachedGoalDays: registeredDays.filter((day) => day.goal.calories > 0 && day.calories >= day.goal.calories * 0.9 && day.calories <= day.goal.calories * 1.1).length,
    registeredDays: registeredDays.length,
    averageCaloriesPerMeal: meals.length >= 2 ? sum(meals.map((meal) => meal.totals.calories)) / meals.length : null,
    initialWeight: weightsSorted[0]?.weightKg ?? null,
    latestWeight: weightsSorted.at(-1)?.weightKg ?? null,
    weightChange: weightsSorted.length >= 2 ? weightsSorted.at(-1)!.weightKg - weightsSorted[0].weightKg : null,
    foodFrequency: [...foodMap.values()].sort((a, b) => b.count - a.count || b.grams - a.grams).slice(0, 8),
  };
};

export const movingAverage = (values: (number | null)[], windowSize = 7): (number | null)[] => values.map((_, index) => {
  const window = values.slice(Math.max(0, index - windowSize + 1), index + 1).filter((value): value is number => value !== null);
  return window.length >= windowSize ? sum(window) / window.length : null;
});
