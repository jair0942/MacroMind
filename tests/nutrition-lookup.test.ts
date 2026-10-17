import { afterEach, describe, expect, it, vi } from 'vitest';

import { lookupOpenFoodFactsBarcode, searchUsda } from '../backend/src/services/nutritionLookupService';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.USDA_API_KEY;
});

const nutrient = (nutrientNumber: string, value: number) => ({ nutrientNumber, value });

describe('resolución de fuentes nutricionales externas', () => {
  it('devuelve coincidencias USDA y conserva la preparación cruda/cocida', async () => {
    process.env.USDA_API_KEY = 'test-only';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ foods: [
      { fdcId: 1, description: 'Rice, white, raw', foodNutrients: [nutrient('1008', 365), nutrient('1003', 7), nutrient('1005', 80), nutrient('1004', 0.7)] },
      { fdcId: 2, description: 'Rice, white, cooked', foodNutrients: [nutrient('1008', 130), nutrient('1003', 2.7), nutrient('1005', 28.2), nutrient('1004', 0.3)] },
    ] }), { status: 200 })));

    const matches = await searchUsda('rice', 'cooked');
    expect(matches).toHaveLength(2);
    expect(matches[0].preparationState).toBe('cooked');
    expect(matches[1].preparationState).toBe('raw');
    expect(matches[0].nutritionPer100g.calories).toBe(130);
  });

  it('descarta resultados USDA sin nutrientes básicos y no inventa valores', async () => {
    process.env.USDA_API_KEY = 'test-only';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ foods: [{ fdcId: 3, description: 'Unknown food', foodNutrients: [] }] }), { status: 200 })));
    await expect(searchUsda('unknown')).resolves.toEqual([]);
  });

  it('lee productos envasados de Open Food Facts por código de barras', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 1, product: {
      product_name: 'Example cereal', nutriments: { 'energy-kcal_100g': 380, proteins_100g: 8, carbohydrates_100g: 70, fat_100g: 6, fiber_100g: 5 },
    } }), { status: 200 })));
    const matches = await lookupOpenFoodFactsBarcode('12345678');
    expect(matches[0]).toMatchObject({ name: 'Example cereal', source: 'openfoodfacts', barcode: '12345678' });
    expect(matches[0].nutritionPer100g.carbohydrates).toBe(70);
  });

  it('requiere la clave USDA solo en el backend', async () => {
    await expect(searchUsda('rice')).rejects.toMatchObject({ statusCode: 503 });
  });

  it('devuelve un error recuperable cuando USDA rechaza las credenciales', async () => {
    process.env.USDA_API_KEY = 'configured-but-invalid';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(searchUsda('rice')).rejects.toMatchObject({ statusCode: 503 });
  });
});
