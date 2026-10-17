import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

import { AnalysisSchema } from '../schemas/analysis.js';
import { AiIntegrationError, analyzeImage } from '../services/openaiService.js';

const RequestSchema = z.object({ imageDataUrl: z.string().min(32).max(8_000_000).regex(/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i) });

const readBody = async (request: IncomingMessage): Promise<string> => {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; if (size > 8_500_000) throw new Error('La imagen supera el tamaño máximo de 8 MB'); chunks.push(buffer); }
  return Buffer.concat(chunks).toString('utf8');
};

export const analyzeRoute = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  try {
    const body = RequestSchema.parse(JSON.parse(await readBody(request)));
    const result = AnalysisSchema.parse(await analyzeImage(body.imageDataUrl));
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(result));
  } catch (cause) {
    const status = cause instanceof z.ZodError ? 400 : cause instanceof AiIntegrationError ? cause.statusCode : 400;
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ error: cause instanceof Error ? cause.message : 'No se pudo analizar la imagen' }));
  }
};
