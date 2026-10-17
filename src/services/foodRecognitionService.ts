import { config } from '@/src/constants/config';
import type { FoodDraft, FoodMatch, PreparationState } from '@/src/types/food';
import { calculateNutrition } from '@/src/utils/calculations';
import { readImageAsDataUrl } from './imageService';
import { resolveRecognizedFood } from './nutritionLookupService';
import { AnalysisResponseSchema, type AnalysisResponse } from './analysisSchema';

type CatalogEntry = { name: string; nutrition: { calories: number; protein: number; carbohydrates: number; fat: number; fiber: number }; aliases: string[]; preparationState: PreparationState };
const catalog: CatalogEntry[] = [
  { name: 'Arroz cocido', aliases: ['arroz', 'rice'], preparationState: 'cooked', nutrition: { calories: 130, protein: 2.7, carbohydrates: 28.2, fat: 0.3, fiber: 0.4 } },
  { name: 'Pechuga de pollo cocida', aliases: ['pollo', 'pechuga de pollo', 'chicken'], preparationState: 'cooked', nutrition: { calories: 165, protein: 31, carbohydrates: 0, fat: 3.6, fiber: 0 } },
  { name: 'Huevo', aliases: ['huevo', 'huevos', 'egg'], preparationState: 'raw', nutrition: { calories: 143, protein: 12.6, carbohydrates: 0.7, fat: 9.5, fiber: 0 } },
  { name: 'Aguacate', aliases: ['aguacate', 'avocado'], preparationState: 'raw', nutrition: { calories: 160, protein: 2, carbohydrates: 8.5, fat: 14.7, fiber: 6.7 } },
  { name: 'Brócoli', aliases: ['brocoli', 'brócoli', 'broccoli'], preparationState: 'raw', nutrition: { calories: 35, protein: 2.4, carbohydrates: 7.2, fat: 0.4, fiber: 3.3 } },
  { name: 'Avena', aliases: ['avena', 'oats'], preparationState: 'raw', nutrition: { calories: 389, protein: 16.9, carbohydrates: 66.3, fat: 6.9, fiber: 10.6 } },
];

const findCatalogEntry = (name: string): CatalogEntry | undefined => {
  const normalized = name.toLocaleLowerCase('es');
  return catalog.find((entry) => entry.aliases.some((alias) => normalized.includes(alias)));
};

export const demoAnalysis = (): AnalysisResponse => ({
  items: [
    { name: 'Arroz cocido', estimated_grams: 150, confidence: 0.82, needs_confirmation: false, preparation_state: 'cooked', notes: null },
    { name: 'Pechuga de pollo cocida', estimated_grams: 140, confidence: 0.78, needs_confirmation: false, preparation_state: 'cooked', notes: 'La preparación y el aceite pueden variar.' },
    { name: 'Brócoli', estimated_grams: 90, confidence: 0.88, needs_confirmation: false, preparation_state: 'raw', notes: null },
  ],
  notes: ['Modo demo: confirma las porciones antes de guardar.'],
});

export const toFoodDrafts = (analysis: AnalysisResponse): FoodDraft[] => analysis.items.map((item) => {
  const entry = findCatalogEntry(item.name);
  const grams = item.estimated_grams ?? 0;
  return {
    name: entry?.name ?? item.name, grams,
    nutrition: entry ? calculateNutrition(grams, entry.nutrition) : { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: null },
    nutritionPer100g: entry?.nutrition, confidence: item.confidence,
    needsConfirmation: item.needs_confirmation || item.estimated_grams === null || !entry, notes: item.notes,
    nutritionSource: entry ? 'local-catalog' : 'unknown', preparationState: item.preparation_state, dataQuality: entry ? 'complete' : 'unknown',
    verified: Boolean(entry), estimationMethod: entry ? 'verified-food' : 'unknown',
  };
});

const matchToDraft = (item: AnalysisResponse['items'][number], match: FoodMatch): FoodDraft => ({
  name: match.name, grams: item.estimated_grams ?? 0, nutrition: calculateNutrition(item.estimated_grams ?? 0, match.nutritionPer100g), nutritionPer100g: match.nutritionPer100g,
  confidence: item.confidence, needsConfirmation: item.needs_confirmation || item.estimated_grams === null, notes: item.notes,
  verified: match.verified, estimationMethod: match.verified ? 'verified-food' : 'manual', matches: [], nutritionSource: match.source,
  sourceId: match.sourceId, barcode: match.barcode, preparationState: match.preparationState, dataQuality: match.dataQuality,
});

export const resolveAnalysisItems = async (analysis: AnalysisResponse): Promise<FoodDraft[]> => Promise.all(analysis.items.map(async (item) => {
  const resolution = await resolveRecognizedFood(item.name, item.preparation_state);
  if (resolution.selected) return matchToDraft(item, resolution.selected);
  return {
    name: item.name, grams: item.estimated_grams ?? 0, nutrition: { calories: 0, protein: 0, carbohydrates: 0, fat: 0, fiber: null },
    confidence: item.confidence, needsConfirmation: true, notes: item.notes ?? resolution.error ?? null, verified: false,
    estimationMethod: 'unknown' as const, matches: resolution.matches, preparationState: item.preparation_state, dataQuality: 'unknown' as const, nutritionSource: 'unknown',
  };
}));

type MealAnalysisResult = { analysis: AnalysisResponse; drafts: FoodDraft[]; demo: boolean };
const analysisInFlight = new Map<string, Promise<MealAnalysisResult>>();

const analyzeMealImageOnce = async (imageUri: string): Promise<MealAnalysisResult> => {
  if (config.demoMode) {
    const analysis = demoAnalysis();
    return { analysis, drafts: toFoodDrafts(analysis), demo: true };
  }
  if (!config.analysisApiUrl) throw new Error('El modo real está activo, pero falta EXPO_PUBLIC_ANALYSIS_API_URL. Configura el backend y reinicia Expo.');
  const imageDataUrl = await readImageAsDataUrl(imageUri);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(`${config.analysisApiUrl.replace(/\/$/, '')}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl }), signal: controller.signal,
    });
    if (!response.ok) {
      let message = `El backend respondió con ${response.status}`;
      try { const body = await response.json() as { error?: unknown }; if (typeof body.error === 'string' && body.error.length > 0) message = body.error; } catch { /* Estado HTTP suficiente. */ }
      throw new Error(message);
    }
    const parsed = AnalysisResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('La respuesta del análisis no tiene un formato válido');
    return { analysis: parsed.data, drafts: await resolveAnalysisItems(parsed.data), demo: false };
  } finally {
    clearTimeout(timeout);
  }
};

export const analyzeMealImage = (imageUri: string): Promise<MealAnalysisResult> => {
  const existing = analysisInFlight.get(imageUri);
  if (existing) return existing;

  const operation = analyzeMealImageOnce(imageUri).finally(() => {
    if (analysisInFlight.get(imageUri) === operation) analysisInFlight.delete(imageUri);
  });
  analysisInFlight.set(imageUri, operation);
  return operation;
};
