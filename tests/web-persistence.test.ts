import { beforeEach, describe, expect, it } from 'vitest';

import { getDatabase, resetDatabaseConnection } from '../src/database/database.web';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  resetDatabaseConnection();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
});

describe('persistencia de la base web', () => {
  it('conserva el estado del onboarding al recargar y permite reiniciarlo', async () => {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT INTO profiles (id, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal, training_type, training_frequency, session_duration_minutes, target_rate_kg_week, safety_context, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'Alex', '1990-01-01', 70, 175, 'male', 'moderate', 'maintenance', 'strength', 3, 60, 0, 'none', '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z',
    );
    await database.runAsync('UPDATE profiles SET onboarding_completed = 1, onboarding_completed_at = ?, updated_at = ? WHERE id = 1', '2026-10-13T00:00:00.000Z', '2026-10-13T00:00:00.000Z');
    resetDatabaseConnection();
    const reloaded = await getDatabase();
    const completed = await reloaded.getFirstAsync<{ onboarding_completed: number }>('SELECT * FROM profiles WHERE id = 1');
    expect(completed?.onboarding_completed).toBe(1);

    await reloaded.runAsync('UPDATE profiles SET onboarding_completed = 0, onboarding_completed_at = NULL, updated_at = ? WHERE id = 1', '2026-10-13T01:00:00.000Z');
    resetDatabaseConnection();
    const reset = await getDatabase();
    const pending = await reset.getFirstAsync<{ onboarding_completed: number }>('SELECT * FROM profiles WHERE id = 1');
    expect(pending?.onboarding_completed).toBe(0);
  });

  it('conserva la fuente, el estado de preparación y el identificador externo en la caché local', async () => {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT INTO foods (name, normalized_name, calories_per_100g, protein_per_100g, carbohydrates_per_100g, fat_per_100g, fiber_per_100g, source, verified, source_id, barcode, preparation_state, data_quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'Example cereal', 'example cereal', 380, 8, 70, 6, 5, 'openfoodfacts', 1, 'openfoodfacts:12345678', '12345678', 'unknown', 'complete',
    );
    resetDatabaseConnection();
    const reloaded = await getDatabase();
    const food = await reloaded.getFirstAsync<{ source: string; source_id: string; barcode: string; preparation_state: string }>('SELECT * FROM foods WHERE normalized_name = ?', 'example cereal');
    expect(food).toMatchObject({ source: 'openfoodfacts', source_id: 'openfoodfacts:12345678', barcode: '12345678', preparation_state: 'unknown' });
  });
  it('conserva comidas e ingredientes al crear una nueva conexión', async () => {
    const firstConnection = await getDatabase();

    await firstConnection.runAsync(
      'INSERT INTO meals (recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      '2026-10-13T13:00:00.000Z', 'lunch', null, 'Comida de prueba', 'confirmed', '2026-10-13T13:00:00.000Z',
    );
    await firstConnection.runAsync(
      'INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      1, null, 'Arroz cocido', 150, 195, 4.05, 42.3, 0.45, 'verified-food', null,
    );

    resetDatabaseConnection();
    const reloadedConnection = await getDatabase();
    const meals = await reloadedConnection.getAllAsync<{ id: number; notes: string }>('SELECT * FROM meals');
    const items = await reloadedConnection.getAllAsync<{ meal_id: number; name: string }>('SELECT * FROM meal_items WHERE meal_id = ?', 1);

    expect(meals).toEqual([{ id: 1, recorded_at: '2026-10-13T13:00:00.000Z', meal_type: 'lunch', image_uri: null, notes: 'Comida de prueba', analysis_status: 'confirmed', created_at: '2026-10-13T13:00:00.000Z' }]);
    expect(items).toEqual([{ id: 1, meal_id: 1, food_id: null, name: 'Arroz cocido', grams: 150, calories: 195, protein: 4.05, carbohydrates: 42.3, fat: 0.45, estimation_method: 'verified-food', notes: null }]);
  });

  it('filtra comidas por fecha local y conserva objetivos previos', async () => {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT INTO meals (recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      '2026-10-12T23:30:00.000Z', 'dinner', null, null, 'confirmed', '2026-10-12T23:30:00.000Z',
    );
    await database.runAsync(
      'INSERT INTO daily_goals (goal_date, calories, protein, carbohydrates, fat) VALUES (?, ?, ?, ?, ?)',
      '2026-10-12', 2000, 150, 220, 65,
    );

    const meals = await database.getAllAsync<{ id: number }>(
      "SELECT * FROM meals WHERE date(recorded_at, 'localtime') >= ? AND date(recorded_at, 'localtime') <= ?",
      '2026-10-12', '2026-10-12',
    );
    const goal = await database.getFirstAsync<{ goal_date: string }>(
      'SELECT * FROM daily_goals WHERE goal_date = ? OR goal_date = (SELECT MAX(goal_date) FROM daily_goals WHERE goal_date <= ?)',
      '2026-10-13', '2026-10-13',
    );

    expect(meals).toHaveLength(1);
    expect(goal?.goal_date).toBe('2026-10-12');
  });

  it('elimina una comida, sus ingredientes y conserva las demás al recargar', async () => {
    const database = await getDatabase();
    await database.runAsync(
      'INSERT INTO meals (recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      '2026-10-13T12:00:00.000Z', 'lunch', null, null, 'confirmed', '2026-10-13T12:00:00.000Z',
    );
    await database.runAsync(
      'INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      1, null, 'Pollo', 120, 198, 37, 0, 4, 'verified-food', null,
    );
    await database.runAsync(
      'INSERT INTO meals (recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      '2026-10-13T13:00:00.000Z', 'lunch', null, null, 'confirmed', '2026-10-13T13:00:00.000Z',
    );
    await database.runAsync(
      'INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      2, null, 'Ensalada', 100, 100, 3, 12, 2, 'manual', null,
    );
    await database.runAsync('DELETE FROM meal_items WHERE meal_id = ?', 1);
    const deleted = await database.runAsync('DELETE FROM meals WHERE id = ?', 1);

    resetDatabaseConnection();
    const reloadedConnection = await getDatabase();
    const meals = await reloadedConnection.getAllAsync<{ id: number }>('SELECT * FROM meals');
    const items = await reloadedConnection.getAllAsync<{ meal_id: number }>('SELECT * FROM meal_items WHERE meal_id = ?', 1);
    const summary = await reloadedConnection.getFirstAsync<{ calories: number }>(
      "SELECT SUM(mi.calories) calories FROM meal_items mi JOIN meals m ON m.id = mi.meal_id WHERE date(m.recorded_at, 'localtime') = ?",
      '2026-10-13',
    );

    expect(deleted.changes).toBe(1);
    expect(meals.map((meal) => meal.id)).toEqual([2]);
    expect(items).toEqual([]);
    expect(summary?.calories).toBe(100);
  });
});
