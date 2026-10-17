import { z } from 'zod';

export const AnalysisResponseSchema = z.object({
  items: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    estimated_grams: z.number().min(0).max(2000).nullable(),
    confidence: z.number().min(0).max(1),
    needs_confirmation: z.boolean(),
    preparation_state: z.enum(['raw', 'cooked', 'fried', 'baked', 'grilled', 'steamed', 'unknown']).default('unknown'),
    notes: z.string().max(500).nullable(),
  })).max(20),
  notes: z.array(z.string().max(500)).max(10),
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
