import type { Food, NutritionDataQuality, PreparationState } from '@/src/types/food';
import type { Nutrition } from '@/src/types/nutrition';
import { getDatabase } from './database';

export const normalizeFoodName = (name: string): string => name.trim().toLocaleLowerCase('es').replace(/\s+/g, ' ');
type FoodRow = { id: number; name: string; normalized_name: string; calories_per_100g: number; protein_per_100g: number; carbohydrates_per_100g: number; fat_per_100g: number; fiber_per_100g: number | null; source: string; verified: number; source_id?: string | null; barcode?: string | null; preparation_state?: PreparationState; data_quality?: NutritionDataQuality };
const mapFood = (row: FoodRow): Food => ({
  id: row.id, name: row.name, normalizedName: row.normalized_name,
  nutritionPer100g: { calories: row.calories_per_100g, protein: row.protein_per_100g, carbohydrates: row.carbohydrates_per_100g, fat: row.fat_per_100g, fiber: row.fiber_per_100g },
  source: row.source, sourceId: row.source_id ?? null, barcode: row.barcode ?? null,
  preparationState: row.preparation_state ?? 'unknown', dataQuality: row.data_quality ?? 'complete', verified: row.verified === 1,
});

export const findFood = async (name: string): Promise<Food | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FoodRow>('SELECT * FROM foods WHERE normalized_name = ?', normalizeFoodName(name));
  return row ? mapFood(row) : null;
};

export const searchFoods = async (query: string): Promise<Food[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FoodRow>('SELECT * FROM foods WHERE name LIKE ? ORDER BY verified DESC, name LIMIT 20', `%${query}%`);
  return rows.map(mapFood);
};

export const upsertFood = async (
  name: string,
  nutrition: Nutrition,
  source: string,
  verified: boolean,
  options: { sourceId?: string | null; barcode?: string | null; preparationState?: PreparationState; dataQuality?: NutritionDataQuality } = {},
): Promise<number> => {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO foods (name, normalized_name, calories_per_100g, protein_per_100g, carbohydrates_per_100g, fat_per_100g, fiber_per_100g, source, verified, source_id, barcode, preparation_state, data_quality)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(normalized_name) DO UPDATE SET name=excluded.name, calories_per_100g=excluded.calories_per_100g,
       protein_per_100g=excluded.protein_per_100g, carbohydrates_per_100g=excluded.carbohydrates_per_100g,
       fat_per_100g=excluded.fat_per_100g, fiber_per_100g=excluded.fiber_per_100g, source=excluded.source, verified=excluded.verified,
       source_id=excluded.source_id, barcode=excluded.barcode, preparation_state=excluded.preparation_state, data_quality=excluded.data_quality`,
    name.trim(), normalizeFoodName(name), nutrition.calories, nutrition.protein, nutrition.carbohydrates, nutrition.fat,
    nutrition.fiber ?? null, source, verified ? 1 : 0, options.sourceId ?? null, options.barcode ?? null,
    options.preparationState ?? 'unknown', options.dataQuality ?? 'complete',
  );
  const food = await findFood(name);
  if (!food) throw new Error('No se pudo guardar el alimento');
  return food.id;
};

const commonFoods: { name: string; nutrition: Nutrition; preparationState: PreparationState; sourceId: string }[] = [
  { name: 'Arroz cocido', nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fiber: 0.4 }, preparationState: 'cooked', sourceId: 'common:arroz-cocido' },
  { name: 'Pechuga de pollo cocida', nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fiber: 0 }, preparationState: 'cooked', sourceId: 'common:pollo-cocido' },
  { name: 'Huevo', nutrition: { calories: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5, fiber: 0 }, preparationState: 'raw', sourceId: 'common:huevo' },
  { name: 'Aguacate', nutrition: { calories: 160, protein: 2, carbohydrates: 8.5, fat: 14.7, fiber: 6.7 }, preparationState: 'raw', sourceId: 'common:aguacate' },
  { name: 'Brócoli', nutrition: { calories: 35, protein: 2.4, carbohydrates: 7.2, fat: 0.4, fiber: 3.3 }, preparationState: 'raw', sourceId: 'common:brocoli' },
  { name: 'Avena', nutrition: { calories: 389, protein: 16.9, carbohydrates: 66.3, fat: 6.9, fiber: 10.6 }, preparationState: 'raw', sourceId: 'common:avena' },
];

export const ensureCommonFoods = async (): Promise<void> => {
  for (const food of commonFoods) {
    if (!await findFood(food.name)) await upsertFood(food.name, food.nutrition, 'local-catalog', true, { sourceId: food.sourceId, preparationState: food.preparationState });
  }
};
