import { describe, expect, it } from 'vitest';

import { calculateBmr, calculateGoalPlan, calculateTdee, macroTargets, targetCalories } from '../src/services/goalCalculator';
import type { Profile } from '../src/types/profile';
import { dateRange, periodRange } from '../src/utils/dates';

const profile: Profile = {
  id: 1, name: null, birthDate: '1990-06-15', currentWeightKg: 70, heightCm: 175, sex: 'male', activityLevel: 'moderate', goal: 'fat_loss',
  trainingType: 'strength', trainingFrequency: 3, sessionDurationMinutes: 60, targetRateKgPerWeek: 0.5, safetyContext: 'none', onboardingCompleted: true, onboardingCompletedAt: null, createdAt: '', updatedAt: '',
};

describe('objetivos personalizados y fechas', () => {
  it('calcula Mifflin St Jeor y actividad', () => {
    expect(calculateBmr(70, 175, 30, 'male')).toBe(1649);
    expect(calculateTdee(1649, 'moderate')).toBe(2556);
  });
  it('limita el déficit y distribuye macros coherentes', () => {
    expect(targetCalories(2500, 'fat_loss', 2)).toBe(2000);
    const macros = macroTargets(2200, 70, 'recomposition', 'strength');
    expect(macros.protein).toBe(126);
    expect(macros.carbohydrates).toBeGreaterThan(0);
    expect(macros.protein * 4 + macros.carbohydrates * 4 + macros.fat * 9).toBeGreaterThan(2100);
  });
  it('no genera metas automáticas para menores', () => {
    const plan = calculateGoalPlan({ ...profile, birthDate: '2012-06-15' }, new Date('2026-06-16T12:00:00'));
    expect(plan.restricted).toBe(true);
    expect(plan.target).toBeNull();
  });
  it('usa lunes como inicio semanal y conserva días sin registros', () => {
    expect(periodRange('week', new Date('2026-10-14T12:00:00'))).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });
});
