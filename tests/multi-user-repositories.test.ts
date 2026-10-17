import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/database/database', async () => import('../src/database/database.web'));
vi.mock('../src/services/authService', () => ({ createPasswordSalt: async () => 'salt', hashPassword: async (password: string, salt: string) => `${salt}:${password}` }));

import { getMealsForDay, saveMeal } from '../src/database/mealRepository';
import { saveProfile } from '../src/database/profileRepository';
import { authenticateUser, registerUser, setActiveUser } from '../src/database/userRepository';
import { resetDatabaseConnection } from '../src/database/database.web';

const storage = new Map<string, string>();
const profileInput = (name: string) => ({ name, birthDate: '1990-01-01', currentWeightKg: 70, heightCm: 175, sex: 'unspecified' as const, activityLevel: 'moderate' as const, goal: 'maintenance' as const, trainingType: 'none' as const, trainingFrequency: 0, sessionDurationMinutes: 0, targetRateKgPerWeek: 0, safetyContext: 'none' as const });

beforeEach(() => {
  storage.clear();
  resetDatabaseConnection();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key), clear: () => storage.clear() } });
});

describe('repositorios multiusuario', () => {
  it('guarda y lee el historial del usuario activo sin mezclarlo', async () => {
    const ana = await registerUser('Ana', 'ana_local', 'secreto1');
    await saveProfile(profileInput('Ana'));
    await saveMeal({ recordedAt: '2026-10-15T12:00:00.000Z', mealType: 'comida', imageUri: null, notes: null, analysisStatus: 'confirmed', items: [{ name: 'Pollo', grams: 100, nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6 }, needsConfirmation: false, verified: true, estimationMethod: 'verified-food' }] });
    const luis = await registerUser('Luis', 'luis_local', 'secreto2');
    await saveProfile(profileInput('Luis'));
    await saveMeal({ recordedAt: '2026-10-15T13:00:00.000Z', mealType: 'comida', imageUri: null, notes: null, analysisStatus: 'confirmed', items: [{ name: 'Arroz', grams: 100, nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3 }, needsConfirmation: false, verified: true, estimationMethod: 'verified-food' }] });

    await setActiveUser(ana.id);
    expect((await getMealsForDay('2026-10-15')).map((meal) => meal.items[0]?.name)).toEqual(['Pollo']);
    await expect(authenticateUser('luis_local', 'secreto2')).resolves.toMatchObject({ id: luis.id });
    expect((await getMealsForDay('2026-10-15')).map((meal) => meal.items[0]?.name)).toEqual(['Arroz']);
    await expect(authenticateUser('luis_local', 'incorrecta')).rejects.toThrow('Usuario o contraseña incorrectos.');
  });
});
