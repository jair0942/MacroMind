import type { FoodDraft } from '@/src/types/food';
import type { DailySummary } from '@/src/types/nutrition';
import type { Meal, MealInput, MealType, AnalysisStatus } from '@/src/types/meal';
import { localDateKey } from '@/src/utils/dates';
import { getDatabase } from './database';
import { getGoal } from './profileRepository';
import { getActiveUserId } from './userRepository';
import { upsertFood } from './foodRepository';

type MealRow = { id: number; recorded_at: string; meal_type: MealType; image_uri: string | null; notes: string | null; analysis_status: AnalysisStatus; created_at: string };
type ItemRow = { id: number; meal_id: number; name: string; grams: number; calories: number; protein: number; carbohydrates: number; fat: number; estimation_method: FoodDraft['estimationMethod']; notes: string | null; nutrition_source?: string | null; source_id?: string | null; barcode?: string | null; preparation_state?: FoodDraft['preparationState']; data_quality?: FoodDraft['dataQuality'] };
const mapItem = (row: ItemRow): FoodDraft => ({
  id: row.id, name: row.name, grams: row.grams,
  nutrition: { calories: row.calories, protein: row.protein, carbohydrates: row.carbohydrates, fat: row.fat },
  needsConfirmation: row.estimation_method === 'unknown', notes: row.notes,
  verified: row.estimation_method === 'verified-food', estimationMethod: row.estimation_method,
  nutritionSource: row.nutrition_source ?? (row.estimation_method === 'verified-food' ? 'local' : 'manual'), sourceId: row.source_id ?? null,
  barcode: row.barcode ?? null, preparationState: row.preparation_state ?? 'unknown', dataQuality: row.data_quality ?? 'unknown',
});

const saveFoodForItem = async (item: FoodDraft): Promise<number | null> => {
  if (item.estimationMethod === 'unknown') return null;
  const factor = item.grams > 0 ? 100 / item.grams : 1;
  const per100g = item.nutritionPer100g ?? {
    calories: item.nutrition.calories * factor, protein: item.nutrition.protein * factor,
    carbohydrates: item.nutrition.carbohydrates * factor, fat: item.nutrition.fat * factor,
    fiber: item.nutrition.fiber == null ? null : item.nutrition.fiber * factor,
  };
  return upsertFood(item.name, per100g, item.nutritionSource ?? (item.verified ? 'local' : 'manual'), item.verified, {
    sourceId: item.sourceId, barcode: item.barcode, preparationState: item.preparationState, dataQuality: item.dataQuality,
  });
};

const totals = (items: FoodDraft[]) => items.reduce((result, item) => ({
  calories: result.calories + item.nutrition.calories, protein: result.protein + item.nutrition.protein,
  carbohydrates: result.carbohydrates + item.nutrition.carbohydrates, fat: result.fat + item.nutrition.fat,
}), { calories: 0, protein: 0, carbohydrates: 0, fat: 0 });

export const saveMeal = async (meal: MealInput): Promise<number> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  const createdAt = new Date().toISOString();
  let mealId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO meals (user_id, recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId, meal.recordedAt, meal.mealType, meal.imageUri ?? null, meal.notes ?? null, meal.analysisStatus, createdAt,
    );
    mealId = result.lastInsertRowId;
    for (const item of meal.items) {
      const foodId = await saveFoodForItem(item);
      await db.runAsync(
        `INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        mealId, foodId, item.name, item.grams, item.nutrition.calories, item.nutrition.protein,
        item.nutrition.carbohydrates, item.nutrition.fat, item.estimationMethod, item.notes ?? null,
      );
    }
  });
  return mealId;
};

export const updateMeal = async (id: number, meal: MealInput): Promise<void> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  await db.withTransactionAsync(async () => {
    const updated = await db.runAsync('UPDATE meals SET recorded_at = ?, meal_type = ?, image_uri = ?, notes = ?, analysis_status = ? WHERE id = ? AND user_id = ?', meal.recordedAt, meal.mealType, meal.imageUri ?? null, meal.notes ?? null, meal.analysisStatus, id, userId);
    if (updated.changes === 0) throw new Error('La comida no existe en el usuario activo.');
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', id);
    for (const item of meal.items) {
      const foodId = await saveFoodForItem(item);
      await db.runAsync(
        `INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, foodId, item.name, item.grams, item.nutrition.calories, item.nutrition.protein, item.nutrition.carbohydrates, item.nutrition.fat, item.estimationMethod, item.notes ?? null,
      );
    }
  });
};

export const getMeal = async (id: number): Promise<Meal | null> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return null;
  const row = await db.getFirstAsync<MealRow>('SELECT * FROM meals WHERE id = ? AND user_id = ?', id, userId);
  if (!row) return null;
  const itemRows = await db.getAllAsync<ItemRow>(`SELECT mi.*, f.source nutrition_source, f.source_id, f.barcode, f.preparation_state, f.data_quality
    FROM meal_items mi LEFT JOIN foods f ON f.id = mi.food_id WHERE mi.meal_id = ? ORDER BY mi.id`, id);
  const items = itemRows.map(mapItem);
  return { id: row.id, recordedAt: row.recorded_at, mealType: row.meal_type, imageUri: row.image_uri, notes: row.notes, analysisStatus: row.analysis_status, items, totals: totals(items) };
};

export const getRecentMeals = async (limit = 5): Promise<Meal[]> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return [];
  const rows = await db.getAllAsync<MealRow>('SELECT * FROM meals WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?', userId, limit);
  const meals = await Promise.all(rows.map((row) => getMeal(row.id)));
  return meals.filter((meal): meal is Meal => meal !== null);
};

export const getMealsForDay = async (date = localDateKey()): Promise<Meal[]> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return [];
  const rows = await db.getAllAsync<MealRow>(`SELECT * FROM meals WHERE user_id = ? AND date(recorded_at, 'localtime') = ? ORDER BY recorded_at DESC`, userId, date);
  const meals = await Promise.all(rows.map((row) => getMeal(row.id)));
  return meals.filter((meal): meal is Meal => meal !== null);
};

export const getMealsBetween = async (startDate: string, endDate: string): Promise<Meal[]> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return [];
  const rows = await db.getAllAsync<MealRow>(
    `SELECT * FROM meals WHERE user_id = ? AND date(recorded_at, 'localtime') >= ? AND date(recorded_at, 'localtime') <= ? ORDER BY recorded_at DESC`,
    userId, startDate, endDate,
  );
  const meals = await Promise.all(rows.map((row) => getMeal(row.id)));
  return meals.filter((meal): meal is Meal => meal !== null);
};

export const getDailySummary = async (date = localDateKey()): Promise<DailySummary> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return { calories: 0, protein: 0, carbohydrates: 0, fat: 0, goal: await getGoal(date) };
  const row = await db.getFirstAsync<{ calories: number | null; protein: number | null; carbohydrates: number | null; fat: number | null }>(
    `SELECT SUM(mi.calories) calories, SUM(mi.protein) protein, SUM(mi.carbohydrates) carbohydrates, SUM(mi.fat) fat
     FROM meal_items mi JOIN meals m ON m.id = mi.meal_id WHERE m.user_id = ? AND date(m.recorded_at, 'localtime') = ?`, userId, date,
  );
  const goal = await getGoal(date);
  return { calories: row?.calories ?? 0, protein: row?.protein ?? 0, carbohydrates: row?.carbohydrates ?? 0, fat: row?.fat ?? 0, goal };
};

export const deleteMeal = async (id: number): Promise<boolean> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return false;
  let deleted = false;
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM meals WHERE id = ? AND user_id = ?', id, userId);
    if (!existing) return;
    await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', id);
    const result = await db.runAsync('DELETE FROM meals WHERE id = ? AND user_id = ?', id, userId);
    deleted = result.changes > 0;
  });
  return deleted;
};
