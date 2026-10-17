import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

import { NutritionSearchResponseSchema } from '../schemas/nutrition.js';
import { lookupOpenFoodFactsBarcode, NutritionLookupError, searchUsda } from '../services/nutritionLookupService.js';

const SearchSchema = z.object({ q: z.string().trim().min(2).max(100), preparation: z.enum(['raw', 'cooked', 'fried', 'baked', 'grilled', 'steamed', 'unknown']).optional() });
const BarcodeSchema = z.object({ barcode: z.string().regex(/^\d{8,14}$/) });

const send = (response: ServerResponse, status: number, body: unknown): void => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };

export const nutritionSearchRoute = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const input = SearchSchema.parse({ q: url.searchParams.get('q') ?? '', preparation: url.searchParams.get('preparation') ?? undefined });
    send(response, 200, NutritionSearchResponseSchema.parse({ source: 'usda', matches: await searchUsda(input.q, input.preparation) }));
  } catch (cause) {
    send(response, cause instanceof z.ZodError ? 400 : cause instanceof NutritionLookupError ? cause.statusCode : 502, { error: cause instanceof Error ? cause.message : 'No se pudo buscar el alimento.' });
  }
};

export const nutritionBarcodeRoute = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const input = BarcodeSchema.parse({ barcode: url.pathname.split('/').pop() ?? '' });
    send(response, 200, NutritionSearchResponseSchema.parse({ source: 'openfoodfacts', matches: await lookupOpenFoodFactsBarcode(input.barcode) }));
  } catch (cause) {
    send(response, cause instanceof z.ZodError ? 400 : cause instanceof NutritionLookupError ? cause.statusCode : 502, { error: cause instanceof Error ? cause.message : 'No se pudo buscar el código de barras.' });
  }
};
