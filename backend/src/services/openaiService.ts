import { z } from 'zod';

import { AnalysisSchema, type AnalysisResponse } from '../schemas/analysis.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';
const REQUEST_TIMEOUT_MS = 45_000;

const ChatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.union([z.string(), z.array(z.object({ type: z.string(), text: z.string().optional() }))]) }),
  })).min(1),
});

export class AiIntegrationError extends Error {
  constructor(public readonly statusCode: 400 | 429 | 502 | 503 | 504, message: string) {
    super(message);
    this.name = 'AiIntegrationError';
  }
}

const configuredProvider = (): string => (process.env.AI_PROVIDER ?? 'openrouter').trim().toLowerCase();

const getOpenRouterConfig = (): { apiKey: string; model: string } => {
  if (configuredProvider() !== 'openrouter') {
    throw new AiIntegrationError(503, 'El backend está configurado para un proveedor de IA no compatible. Usa AI_PROVIDER=openrouter.');
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey === 'sk-or-v1-example-only') {
    throw new AiIntegrationError(503, 'OPENROUTER_API_KEY no está configurada en el backend.');
  }
  return { apiKey, model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL };
};

const prompt = `Eres un asistente de estimación nutricional. Analiza la fotografía y devuelve únicamente un objeto JSON válido con esta forma exacta:
{"items":[{"name":"Arroz cocido","preparation_state":"cooked","estimated_grams":150,"confidence":0.8,"needs_confirmation":false,"notes":null}],"notes":[]}

Reglas:
- Identifica alimentos probables y distingue crudo de cocido cuando sea visible.
- preparation_state debe ser raw, cooked, fried, baked, grilled, steamed o unknown. Usa unknown si la fotografía no permite distinguirlo.
- estimated_grams debe ser un número aproximado entre 0 y 2000 o null si no puedes estimarlo razonablemente.
- confidence es una valoración orientativa entre 0 y 1, no una probabilidad calibrada.
- Usa needs_confirmation=true para porciones, ingredientes o preparaciones inciertas.
- Menciona aceite, salsas, ingredientes ocultos y cualquier incertidumbre en notes o en notes del alimento.
- No inventes cantidades exactas ni ingredientes que no sean visibles.
- La respuesta será revisada por una persona antes de guardarse.`;

const contentText = (content: string | Array<{ type: string; text?: string }>): string => {
  if (typeof content === 'string') return content;
  return content.map((part) => part.text ?? '').join('').trim();
};

const parseJsonContent = (content: string): AnalysisResponse => {
  const withoutFence = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return AnalysisSchema.parse(JSON.parse(withoutFence));
  } catch {
    throw new AiIntegrationError(502, 'OpenRouter devolvió una respuesta que no cumple el esquema nutricional.');
  }
};

const upstreamMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return typeof body.error?.message === 'string' ? body.error.message.slice(0, 300) : '';
  } catch {
    return '';
  }
};

export const analyzeImage = async (imageDataUrl: string): Promise<AnalysisResponse> => {
  const { apiKey, model } = getOpenRouterConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://macromind.local',
        'X-Title': 'MacroMind',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analiza esta comida y responde en español.' },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await upstreamMessage(response);
      if (response.status === 401 || response.status === 403) throw new AiIntegrationError(502, 'OpenRouter rechazó la clave configurada.');
      if (response.status === 404) throw new AiIntegrationError(502, `OpenRouter no encontró el modelo configurado: ${model}.`);
      if (response.status === 429) throw new AiIntegrationError(429, 'OpenRouter o el límite local no permiten más solicitudes ahora.');
      throw new AiIntegrationError(502, detail ? `OpenRouter rechazó la solicitud: ${detail}` : `OpenRouter respondió con HTTP ${response.status}.`);
    }

    const parsed = ChatResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new AiIntegrationError(502, 'OpenRouter devolvió una respuesta sin contenido utilizable.');
    return parseJsonContent(contentText(parsed.data.choices[0].message.content));
  } catch (cause) {
    if (cause instanceof AiIntegrationError) throw cause;
    if (cause instanceof Error && cause.name === 'AbortError') throw new AiIntegrationError(504, 'OpenRouter tardó demasiado en responder.');
    throw new AiIntegrationError(502, 'No se pudo conectar con OpenRouter.');
  } finally {
    clearTimeout(timeout);
  }
};
