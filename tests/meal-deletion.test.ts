import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  database: {
    getFirstAsync: vi.fn(),
    runAsync: vi.fn(),
    withTransactionAsync: vi.fn(),
  },
  getDatabase: vi.fn(),
}));

vi.mock('../src/database/database', () => ({ getDatabase: mocks.getDatabase }));

import { deleteMeal } from '../src/database/mealRepository';

describe('eliminación de comidas', () => {
  it('usa el ID, borra ingredientes antes que la comida y devuelve éxito', async () => {
    mocks.getDatabase.mockResolvedValue(mocks.database);
    mocks.database.getFirstAsync.mockResolvedValue({ id: 42 });
    mocks.database.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 0 });
    mocks.database.withTransactionAsync.mockImplementation(async (callback: () => Promise<boolean>) => callback());

    await expect(deleteMeal(42)).resolves.toBe(true);
    expect(mocks.database.getFirstAsync).toHaveBeenCalledWith('SELECT id FROM meals WHERE id = ? AND user_id = ?', 42, 1);
    expect(mocks.database.runAsync.mock.calls.map(([sql]) => sql)).toEqual([
      'DELETE FROM meal_items WHERE meal_id = ?',
      'DELETE FROM meals WHERE id = ? AND user_id = ?',
    ]);
    expect(mocks.database.runAsync.mock.calls.map(([, id]) => id)).toEqual([42, 42]);
  });

  it('no intenta borrar cuando el ID ya no existe', async () => {
    mocks.getDatabase.mockResolvedValue(mocks.database);
    mocks.database.getFirstAsync.mockResolvedValue(null);
    mocks.database.runAsync.mockClear();
    mocks.database.withTransactionAsync.mockImplementation(async (callback: () => Promise<boolean>) => callback());

    await expect(deleteMeal(999)).resolves.toBe(false);
    expect(mocks.database.runAsync).not.toHaveBeenCalled();
  });
});
