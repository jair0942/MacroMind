import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGoal: vi.fn(),
  getMealsBetween: vi.fn(),
  listWeightEntries: vi.fn(),
}));

vi.mock('@/src/database/profileRepository', () => ({ getGoal: mocks.getGoal }));
vi.mock('@/src/database/mealRepository', () => ({ getMealsBetween: mocks.getMealsBetween }));
vi.mock('@/src/database/weightRepository', () => ({ listWeightEntries: mocks.listWeightEntries }));

import { buildStatistics } from '@/src/services/statisticsService';

describe('estadísticas agregadas', () => {
  it('distingue días sin registros y calcula totales desde las comidas recibidas', async () => {
    mocks.getGoal.mockResolvedValue({ calories: 2000, protein: 150, carbohydrates: 220, fat: 65 });
    mocks.getMealsBetween.mockResolvedValue([
      {
        id: 1, recordedAt: '2026-10-12T12:00:00.000Z', mealType: 'comida', imageUri: null, notes: null, analysisStatus: 'confirmed',
        items: [{ name: 'Arroz cocido', grams: 150, nutrition: { calories: 195, protein: 4, carbohydrates: 42, fat: 0.5 }, needsConfirmation: false, verified: true, estimationMethod: 'verified-food' }],
        totals: { calories: 195, protein: 4, carbohydrates: 42, fat: 0.5 },
      },
      {
        id: 2, recordedAt: '2026-10-14T12:00:00.000Z', mealType: 'cena', imageUri: null, notes: null, analysisStatus: 'confirmed',
        items: [{ name: 'Arroz cocido', grams: 100, nutrition: { calories: 130, protein: 3, carbohydrates: 28, fat: 0.3 }, needsConfirmation: false, verified: true, estimationMethod: 'verified-food' }],
        totals: { calories: 130, protein: 3, carbohydrates: 28, fat: 0.3 },
      },
    ]);
    mocks.listWeightEntries.mockResolvedValue([
      { id: 1, date: '2026-10-12', recordedAt: '2026-10-12T12:00:00.000Z', weightKg: 80, notes: null },
      { id: 2, date: '2026-10-14', recordedAt: '2026-10-14T12:00:00.000Z', weightKg: 79.5, notes: null },
    ]);

    const result = await buildStatistics('2026-10-12', '2026-10-14');

    expect(result.caloriesConsumed).toBe(325);
    expect(result.registeredDays).toBe(2);
    expect(result.averageCalories).toBe(162.5);
    expect(result.averageCaloriesPerMeal).toBe(162.5);
    expect(result.days.map((day) => day.hasRecords)).toEqual([true, false, true]);
    expect(result.foodFrequency[0]).toMatchObject({ name: 'Arroz cocido', count: 2, grams: 250 });
    expect(result.initialWeight).toBe(80);
    expect(result.latestWeight).toBe(79.5);
    expect(result.weightChange).toBe(-0.5);
  });
});
