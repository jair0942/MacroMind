import { describe, expect, it } from 'vitest';

import { calculateNutrition, distributeMacros, estimateBmr, ratio, sumNutrition } from '../src/utils/calculations';

describe('motor nutricional', () => {
  it('calcula nutrientes por gramos', () => {
    expect(calculateNutrition(150, { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3 })).toMatchObject({ calories: 195, protein: 4.05, carbohydrates: 42.3, fat: 0.45 });
  });
  it('no genera nutrientes negativos', () => {
    expect(calculateNutrition(-20, { calories: 100, protein: 10, carbohydrates: 10, fat: 10 })).toMatchObject({ calories: 0, protein: 0, carbohydrates: 0, fat: 0 });
  });
  it('suma elementos y limita el progreso', () => {
    expect(sumNutrition([{ calories: 100, protein: 5, carbohydrates: 10, fat: 2 }, { calories: 200, protein: 10, carbohydrates: 20, fat: 4 }])).toMatchObject({ calories: 300, protein: 15 });
    expect(ratio(2500, 2000)).toBe(1);
  });
  it('estima bmr solo con sexo declarado y distribuye macros', () => {
    expect(estimateBmr(70, 175, 30, 'unspecified')).toBeNull();
    const macros = distributeMacros(2000, 70, 'fat_loss');
    expect(macros.protein).toBeGreaterThan(0); expect(macros.carbohydrates).toBeGreaterThan(0);
  });
});
