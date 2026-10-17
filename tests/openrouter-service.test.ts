import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyzeImage } from '../backend/src/services/openaiService';

const environmentKeys = ['AI_PROVIDER', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('integración OpenRouter', () => {
  it('envía el modelo configurado y la imagen como contenido multimodal', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-only';
    process.env.OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ name: 'Arroz cocido', estimated_grams: 150, confidence: 0.8, needs_confirmation: false, notes: null }], notes: [] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeImage('data:image/jpeg;base64,AAAA');
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { model: string; messages: Array<{ content: unknown }> };

    expect(result.items[0].name).toBe('Arroz cocido');
    expect(request.model).toBe('google/gemma-4-26b-a4b-it:free');
    expect(request.messages[1].content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image_url' })]));
  });

  it('rechaza una respuesta que no cumple el esquema', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-only';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[{"name":"sin gramos"}]}' } }] }), { status: 200 })));

    await expect(analyzeImage('data:image/jpeg;base64,AAAA')).rejects.toMatchObject({ statusCode: 502 });
  });

  it('devuelve error de configuración sin realizar una solicitud', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    delete process.env.OPENROUTER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeImage('data:image/jpeg;base64,AAAA')).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
