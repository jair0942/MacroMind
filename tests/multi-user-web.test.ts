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

describe('aislamiento de usuarios en la persistencia web', () => {
  it('separa comidas y objetivos por usuario y conserva el estado al recargar', async () => {
    const database = await getDatabase();
    await database.runAsync('INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)', 1, 'Ana', '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z');
    await database.runAsync('INSERT INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)', 2, 'Luis', '2026-10-15T00:00:00.000Z', '2026-10-15T00:00:00.000Z');
    await database.runAsync('INSERT INTO meals (user_id, recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 1, '2026-10-15T12:00:00.000Z', 'comida', null, 'Ana', 'confirmed', '2026-10-15T12:00:00.000Z');
    const anaMealId = 1;
    await database.runAsync('INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', anaMealId, null, 'Pollo', 120, 198, 37, 0, 4, 'verified-food', null);
    await database.runAsync('INSERT INTO meals (user_id, recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 2, '2026-10-15T13:00:00.000Z', 'comida', null, 'Luis', 'confirmed', '2026-10-15T13:00:00.000Z');
    await database.runAsync('INSERT INTO meal_items (meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 2, null, 'Arroz', 150, 195, 4, 42, 1, 'verified-food', null);
    await database.runAsync('INSERT INTO daily_goals (user_id, goal_date, calories, protein, carbohydrates, fat) VALUES (?, ?, ?, ?, ?, ?)', 1, '2026-10-15', 1800, 130, 180, 60);
    await database.runAsync('INSERT INTO daily_goals (user_id, goal_date, calories, protein, carbohydrates, fat) VALUES (?, ?, ?, ?, ?, ?)', 2, '2026-10-15', 2400, 170, 260, 80);

    const anaMeals = await database.getAllAsync<{ id: number }>('SELECT * FROM meals WHERE user_id = ? ORDER BY recorded_at DESC', 1);
    const luisMeals = await database.getAllAsync<{ id: number }>('SELECT * FROM meals WHERE user_id = ? ORDER BY recorded_at DESC', 2);
    const anaSummary = await database.getFirstAsync<{ calories: number }>("SELECT SUM(mi.calories) calories FROM meal_items mi JOIN meals m ON m.id = mi.meal_id WHERE m.user_id = ? AND date(m.recorded_at, 'localtime') = ?", 1, '2026-10-15');
    const luisSummary = await database.getFirstAsync<{ calories: number }>("SELECT SUM(mi.calories) calories FROM meal_items mi JOIN meals m ON m.id = mi.meal_id WHERE m.user_id = ? AND date(m.recorded_at, 'localtime') = ?", 2, '2026-10-15');

    expect(anaMeals.map((meal) => meal.id)).toEqual([1]);
    expect(luisMeals.map((meal) => meal.id)).toEqual([2]);
    expect(anaSummary?.calories).toBe(198);
    expect(luisSummary?.calories).toBe(195);

    resetDatabaseConnection();
    const reloaded = await getDatabase();
    const persistedUsers = await reloaded.getAllAsync<{ id: number }>('SELECT * FROM users ORDER BY id');
    expect(persistedUsers.map((user) => user.id)).toEqual([1, 2]);
  });
});
