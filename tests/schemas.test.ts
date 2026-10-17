import { describe, expect, it } from 'vitest';

import { AnalysisResponseSchema } from '../src/services/analysisSchema';
import { BackupSchema } from '../src/services/backupSchema';

describe('esquemas de datos', () => {
  it('acepta porción desconocida y requiere confirmación', () => {
    const result = AnalysisResponseSchema.safeParse({ items: [{ name: 'Salsa', estimated_grams: null, confidence: 0.2, needs_confirmation: true, notes: 'No visible' }], notes: [] });
    expect(result.success).toBe(true);
  });
  it('rechaza confianza fuera de rango', () => {
    expect(AnalysisResponseSchema.safeParse({ items: [{ name: 'Arroz', estimated_grams: 100, confidence: 2, needs_confirmation: false, notes: null }], notes: [] }).success).toBe(false);
  });
  it('valida la versión del respaldo', () => {
    const base = { version: 1, exportedAt: new Date().toISOString(), profiles: [], daily_goals: [], foods: [], meals: [], meal_items: [], weight_entries: [] };
    expect(BackupSchema.safeParse(base).success).toBe(true);
    expect(BackupSchema.safeParse({ ...base, version: 2, users: [], app_settings: [] }).success).toBe(true);
  });
});
